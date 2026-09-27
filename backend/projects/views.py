import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .authentication import authenticate_supabase_token
from .models import Project


MAX_UPLOAD_SIZE = 100 * 1024 * 1024


IGNORED_NAMES = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".next",
    "dist",
    "build",
}


IGNORED_FILES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
}


def should_ignore(path: Path) -> bool:
    parts = set(path.parts)

    if parts.intersection(IGNORED_NAMES):
        return True

    if path.name in IGNORED_FILES:
        return True

    return False


def safe_extract_zip(zip_file, destination):
    destination = Path(destination).resolve()

    for member in zip_file.infolist():
        member_path = (
            destination / member.filename
        ).resolve()

        if not str(member_path).startswith(
            str(destination)
        ):
            raise ValueError(
                "Unsafe ZIP file."
            )

        if should_ignore(
            Path(member.filename)
        ):
            continue

        zip_file.extract(
            member,
            destination,
        )


@csrf_exempt
@require_POST
def upload_project(request):
    try:
        payload = authenticate_supabase_token(
            request
        )

        user_id = payload.get("sub")

        if not user_id:
            return JsonResponse(
                {
                    "error": "Invalid user."
                },
                status=401,
            )

        uploaded_file = request.FILES.get(
            "file"
        )

        if not uploaded_file:
            return JsonResponse(
                {
                    "error": "No file provided."
                },
                status=400,
            )

        if uploaded_file.size > MAX_UPLOAD_SIZE:
            return JsonResponse(
                {
                    "error": "Project exceeds the 100 MB limit."
                },
                status=413,
            )

        if not uploaded_file.name.lower().endswith(
            ".zip"
        ):
            return JsonResponse(
                {
                    "error": "Only ZIP files are supported."
                },
                status=400,
            )

        project_name = Path(
            uploaded_file.name
        ).stem

        with tempfile.TemporaryDirectory() as temp_dir:

            zip_path = (
                Path(temp_dir)
                / uploaded_file.name
            )

            with open(
                zip_path,
                "wb",
            ) as destination:

                for chunk in uploaded_file.chunks():
                    destination.write(chunk)

            if not zipfile.is_zipfile(
                zip_path
            ):
                return JsonResponse(
                    {
                        "error": "Invalid ZIP file."
                    },
                    status=400,
                )

            extract_path = (
                Path(temp_dir)
                / "project"
            )

            extract_path.mkdir()

            with zipfile.ZipFile(
                zip_path,
                "r",
            ) as archive:

                safe_extract_zip(
                    archive,
                    extract_path,
                )

            storage_root = (
                Path(settings.BASE_DIR)
                / "storage"
                / str(user_id)
            )

            storage_root.mkdir(
                parents=True,
                exist_ok=True,
            )

            project_id = str(
                Project.objects.create(
                    user_id=user_id,
                    name=project_name,
                    source="upload",
                    storage_path="",
                ).id
            )

            final_path = (
                storage_root
                / project_id
            )

            shutil.copytree(
                extract_path,
                final_path,
                dirs_exist_ok=True,
            )

            project = Project.objects.get(
                id=project_id
            )

            project.storage_path = str(
                final_path
            )

            project.save(
                update_fields=[
                    "storage_path"
                ]
            )

        return JsonResponse(
            {
                "id": str(project.id),
                "name": project.name,
                "source": project.source,
                "message": "Project uploaded successfully.",
            },
            status=201,
        )

    except ValueError as exc:
        return JsonResponse(
            {
                "error": str(exc)
            },
            status=400,
        )

    except Exception as exc:
        return JsonResponse(
            {
                "error": "Upload failed."
            },
            status=500,
        )