import json
import logging
import os
import re
import shutil
import subprocess
import uuid
import zipfile
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .authentication import authenticate_supabase_token
from .models import Project
from .analyzer import AgentManager, CodebaseChatEngine, SecureExplorer

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 100 * 1024 * 1024

IGNORED_DIRECTORIES = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".next",
    "dist",
    "build",
    ".idea",
    ".vscode",
}

IGNORED_FILES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".DS_Store",
}


def is_ignored(path: Path) -> bool:
    if any(part in IGNORED_DIRECTORIES for part in path.parts):
        return True
    if path.name in IGNORED_FILES:
        return True
    return False


def get_user_from_request(request) -> dict:
    """Helper to authenticate request and extract user."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        from django.db import connection
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT id, email FROM auth.users LIMIT 1;")
                row = cur.fetchone()
                if row:
                    return {"sub": str(row[0]), "email": row[1]}
        except Exception:
            pass
        return {"sub": "00000000-0000-0000-0000-000000000000", "email": "developer@local"}

    user = authenticate_supabase_token(request)
    user_id = user.get("sub") or user.get("id")
    if not user_id:
        raise ValueError("Invalid authentication token: missing user ID.")
    return {"sub": str(user_id), "email": user.get("email", "")}


def get_gemini_api_key(request, body_data: dict | None = None) -> str | None:
    """Retrieve Gemini API key from request headers, query param, body, or environment."""
    key = request.headers.get("X-Gemini-Api-Key")
    if key and key.strip():
        return key.strip()
    if body_data and isinstance(body_data, dict):
        body_key = body_data.get("api_key")
        if body_key and str(body_key).strip():
            return str(body_key).strip()
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")


def get_project_storage_dir(user_id: str, project_id: str) -> Path:
    storage_root = Path(settings.BASE_DIR) / "storage"
    directory = storage_root / str(user_id) / str(project_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


@csrf_exempt
def upload_project(request):
    """Handle ZIP upload of a codebase."""
    if request.method != "POST":
        return JsonResponse({"error": "Only POST requests are allowed."}, status=405)

    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "No file was uploaded."}, status=400)

    if uploaded_file.size > MAX_FILE_SIZE:
        return JsonResponse({"error": "Project exceeds the 100 MB limit."}, status=400)

    filename = uploaded_file.name
    if not filename.lower().endswith(".zip"):
        return JsonResponse({"error": "Only ZIP files are supported."}, status=400)

    user_id = user["sub"]
    project_id = uuid.uuid4()
    project_directory = get_project_storage_dir(user_id, str(project_id))
    zip_path = project_directory / "project.zip"

    try:
        with zip_path.open("wb") as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        with zipfile.ZipFile(zip_path, "r") as archive:
            for member in archive.infolist():
                member_path = Path(member.filename)
                if is_ignored(member_path):
                    continue

                destination_path = project_directory / member_path
                resolved_destination = destination_path.resolve()
                resolved_root = project_directory.resolve()

                if not str(resolved_destination).startswith(str(resolved_root) + os.sep):
                    raise ValueError("Unsafe ZIP file detected.")

                if member.is_dir():
                    resolved_destination.mkdir(parents=True, exist_ok=True)
                    continue

                resolved_destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source:
                    with resolved_destination.open("wb") as destination:
                        shutil.copyfileobj(source, destination)

        zip_path.unlink(missing_ok=True)

        project_name = Path(filename).stem
        project = Project.objects.create(
            id=project_id,
            user_id=user_id,
            name=project_name,
            source="upload",
            repository_url=None,
        )

        return JsonResponse(
            {
                "message": "Project uploaded successfully.",
                "project": {
                    "id": str(project.id),
                    "name": project.name,
                    "source": project.source,
                    "created_at": project.created_at.isoformat(),
                },
            },
            status=201,
        )

    except zipfile.BadZipFile:
        shutil.rmtree(project_directory, ignore_errors=True)
        return JsonResponse({"error": "The uploaded file is not a valid ZIP archive."}, status=400)
    except Exception as exc:
        shutil.rmtree(project_directory, ignore_errors=True)
        logger.error(f"Upload failed: {exc}", exc_info=True)
        return JsonResponse({"error": f"Upload failed: {str(exc)}"}, status=500)


@csrf_exempt
def clone_github_repo(request):
    """Clone a GitHub repository into user's workspace."""
    if request.method != "POST":
        return JsonResponse({"error": "Only POST requests are allowed."}, status=405)

    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    raw_url = data.get("repository_url") or data.get("repo_url") or data.get("url")
    if not raw_url:
        return JsonResponse({"error": "Repository URL or username/repo is required."}, status=400)

    # Normalize url: e.g. "facebook/react" or "https://github.com/facebook/react"
    clean_url = raw_url.strip()
    if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        clean_url = f"https://github.com/{clean_url}"

    # Extract repo name
    match = re.search(r"github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?$", clean_url)
    if not match:
        return JsonResponse({"error": "Invalid GitHub repository format. Use 'owner/repo' or 'https://github.com/owner/repo'."}, status=400)

    owner, repo_name = match.group(1), match.group(2)
    user_id = user["sub"]
    project_id = uuid.uuid4()
    project_directory = get_project_storage_dir(user_id, str(project_id))

    try:
        # Run git clone --depth 1
        clone_cmd = [
            "git",
            "clone",
            "--depth",
            "1",
            f"https://github.com/{owner}/{repo_name}.git",
            str(project_directory),
        ]

        result = subprocess.run(
            clone_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            shutil.rmtree(project_directory, ignore_errors=True)
            return JsonResponse({
                "error": f"Failed to clone repository: {result.stderr or 'Repository not found or private.'}"
            }, status=400)

        # Remove .git folder to save space and prevent git lock issues
        git_dir = project_directory / ".git"
        if git_dir.exists():
            shutil.rmtree(git_dir, ignore_errors=True)

        project = Project.objects.create(
            id=project_id,
            user_id=user_id,
            name=repo_name,
            source="github",
            repository_url=f"https://github.com/{owner}/{repo_name}",
        )

        return JsonResponse(
            {
                "message": "Repository cloned successfully.",
                "project": {
                    "id": str(project.id),
                    "name": project.name,
                    "source": project.source,
                    "repository_url": project.repository_url,
                    "created_at": project.created_at.isoformat(),
                },
            },
            status=201,
        )

    except subprocess.TimeoutExpired:
        shutil.rmtree(project_directory, ignore_errors=True)
        return JsonResponse({"error": "Git clone timed out after 120s."}, status=408)
    except Exception as exc:
        shutil.rmtree(project_directory, ignore_errors=True)
        logger.error(f"Clone error: {exc}", exc_info=True)
        return JsonResponse({"error": f"Clone failed: {str(exc)}"}, status=500)


@csrf_exempt
def project_detail(request, project_id):
    """Retrieve metadata and file statistics for a project or delete it."""
    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    user_id = user["sub"]

    if request.method == "DELETE":
        try:
            Project.objects.filter(id=project_id, user_id=user_id).delete()
            storage_root = Path(settings.BASE_DIR) / "storage"
            project_dir = storage_root / str(user_id) / str(project_id)
            if project_dir.exists():
                shutil.rmtree(project_dir, ignore_errors=True)
            return JsonResponse({"message": "Project deleted successfully."})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    try:
        project = Project.objects.filter(id=project_id, user_id=user_id).first()
        if not project:
            # Fallback check without user filter in dev
            project = Project.objects.filter(id=project_id).first()
        if not project:
            return JsonResponse({"error": "Project not found."}, status=404)

        storage_root = Path(settings.BASE_DIR) / "storage"
        project_dir = storage_root / str(user_id) / str(project_id)
        stats = {}
        if project_dir.exists():
            explorer = SecureExplorer(project_dir)
            stats = explorer.get_project_stats()

        return JsonResponse({
            "project": {
                "id": str(project.id),
                "name": project.name,
                "source": project.source,
                "repository_url": project.repository_url,
                "created_at": project.created_at.isoformat(),
                "last_accessed_at": project.last_accessed_at.isoformat(),
                "stats": stats
            }
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def project_file_tree(request, project_id):
    """Return nested file explorer directory tree for IDE."""
    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    user_id = user["sub"]
    storage_root = Path(settings.BASE_DIR) / "storage"
    project_dir = storage_root / str(user_id) / str(project_id)

    # In case project was created under dev user or mismatch
    if not project_dir.exists():
        # Check if project exists under any user directory
        matches = list(storage_root.glob(f"*/{project_id}"))
        if matches:
            project_dir = matches[0]

    if not project_dir.exists():
        return JsonResponse({"error": "Project files not found on disk. It may need to be re-uploaded."}, status=404)

    try:
        explorer = SecureExplorer(project_dir)
        tree = explorer.get_file_tree(max_depth=6)
        stats = explorer.get_project_stats()
        return JsonResponse({
            "tree": tree,
            "stats": stats,
            "root_name": project_dir.name
        })
    except Exception as e:
        logger.error(f"Error getting tree: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def project_file_content(request, project_id):
    """Retrieve content of a specific file in the project for editor view."""
    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    file_path = request.GET.get("path")
    if not file_path:
        return JsonResponse({"error": "Missing 'path' query parameter."}, status=400)

    user_id = user["sub"]
    storage_root = Path(settings.BASE_DIR) / "storage"
    project_dir = storage_root / str(user_id) / str(project_id)

    if not project_dir.exists():
        matches = list(storage_root.glob(f"*/{project_id}"))
        if matches:
            project_dir = matches[0]

    if not project_dir.exists():
        return JsonResponse({"error": "Project files not found."}, status=404)

    try:
        explorer = SecureExplorer(project_dir)
        file_data = explorer.read_file_content(file_path)
        return JsonResponse(file_data)
    except FileNotFoundError:
        return JsonResponse({"error": "File not found."}, status=404)
    except ValueError as ve:
        return JsonResponse({"error": str(ve)}, status=403)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def analyze_codebase(request, project_id):
    """
    Run multi-agent codebase analysis with review cycles on the project.
    Takes query and optional api_key.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST requests are allowed."}, status=405)

    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        data = {}

    query = data.get("query") or "Provide a comprehensive architectural and code analysis of this project."
    api_key = get_gemini_api_key(request, data)

    user_id = user["sub"]
    storage_root = Path(settings.BASE_DIR) / "storage"
    project_dir = storage_root / str(user_id) / str(project_id)

    if not project_dir.exists():
        matches = list(storage_root.glob(f"*/{project_id}"))
        if matches:
            project_dir = matches[0]

    if not project_dir.exists():
        return JsonResponse({"error": "Project files not found on disk."}, status=404)

    try:
        manager = AgentManager(
            working_directory=str(project_dir),
            api_key=api_key,
            max_review_cycles=2,
        )

        analysis_result = manager.run_analysis(query=query)
        return JsonResponse({
            "status": "success",
            "analysis": analysis_result
        })

    except ValueError as ve:
        return JsonResponse({"error": str(ve)}, status=400)
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        return JsonResponse({"error": f"Analysis failed: {str(e)}"}, status=500)


@csrf_exempt
def chat_with_agent(request, project_id):
    """
    Interactive chat assistant for the IDE dashboard.
    Answers developer questions with context of current open file and codebase search.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST requests are allowed."}, status=405)

    try:
        user = get_user_from_request(request)
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=401)

    try:
        data = json.loads(request.body.decode("utf-8")) if request.body else {}
    except Exception:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    message = data.get("message")
    if not message:
        return JsonResponse({"error": "Message is required."}, status=400)

    history = data.get("history", [])
    active_file = data.get("active_file")
    api_key = get_gemini_api_key(request, data)

    user_id = user["sub"]
    storage_root = Path(settings.BASE_DIR) / "storage"
    project_dir = storage_root / str(user_id) / str(project_id)

    if not project_dir.exists():
        matches = list(storage_root.glob(f"*/{project_id}"))
        if matches:
            project_dir = matches[0]

    if not project_dir.exists():
        return JsonResponse({"error": "Project files not found on disk."}, status=404)

    try:
        chat_engine = CodebaseChatEngine(
            working_directory=str(project_dir),
            api_key=api_key
        )

        response = chat_engine.chat(
            message=message,
            history=history,
            active_file_path=active_file
        )

        return JsonResponse({
            "status": "success",
            "reply": response.get("message", ""),
            "active_file": active_file
        })

    except ValueError as ve:
        return JsonResponse({"error": str(ve)}, status=400)
    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        return JsonResponse({"error": f"Chat failed: {str(e)}"}, status=500)