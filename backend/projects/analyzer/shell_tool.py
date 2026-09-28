"""
Secure exploration and shell execution tool for codebase analysis.
Constrained strictly to the project directory with timeouts and read-only checks.
"""
import os
import subprocess
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Commands strictly prohibited
BLOCKED_PATTERNS = [
    "rm ", "rmdir", "mv ", "chmod", "chown", "curl ", "wget ", "ssh ",
    "sudo", "su ", ":(){ :|:& };:", "dd ", "mkfs", "shutdown", "reboot",
    "kill", "pkill", "> /", ">> /", "nc ", "netcat", "python -c", "eval"
]

IGNORED_DIRS = {
    "node_modules", ".git", ".venv", "venv", "__pycache__",
    ".pytest_cache", ".next", "dist", "build", ".idea", ".vscode"
}

IGNORED_FILES = {
    ".env", ".env.local", ".env.development", ".env.production", ".DS_Store"
}


class SecureExplorer:
    """Provides controlled read-only inspection of a project codebase directory."""

    def __init__(
        self,
        working_directory: str | Path,
        timeout_seconds: float = 20.0,
        max_output_size: int = 15000,
    ):
        self.working_directory = Path(working_directory).resolve()
        self.timeout_seconds = timeout_seconds
        self.max_output_size = max_output_size

        if not self.working_directory.exists() or not self.working_directory.is_dir():
            raise ValueError(f"Project directory does not exist or is invalid: {self.working_directory}")

    def execute_command(self, command: str) -> dict[str, Any]:
        """Execute a read-only shell command safely within the working directory."""
        command = command.strip()
        if not command:
            return {"command": command, "success": False, "stdout": "", "stderr": "Command cannot be empty"}

        # Security check: disallow destructive commands
        lower_cmd = command.lower()
        for pattern in BLOCKED_PATTERNS:
            if pattern in lower_cmd:
                return {
                    "command": command,
                    "success": False,
                    "stdout": "",
                    "stderr": f"Security restriction: Command pattern '{pattern}' is not permitted."
                }

        # Check for path traversal attempts trying to break out
        if "../" in command:
            parts = command.split()
            for part in parts:
                if "../" in part:
                    target = (self.working_directory / part).resolve()
                    if not str(target).startswith(str(self.working_directory)):
                        return {
                            "command": command,
                            "success": False,
                            "stdout": "",
                            "stderr": "Security restriction: Path traversal outside project directory is forbidden."
                        }

        try:
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=str(self.working_directory),
                env=dict(os.environ, PATH=os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin")),
            )

            try:
                stdout, stderr = process.communicate(timeout=self.timeout_seconds)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                return {
                    "command": command,
                    "success": False,
                    "stdout": "",
                    "stderr": f"Command timed out after {self.timeout_seconds}s."
                }

            if len(stdout) > self.max_output_size:
                stdout = stdout[: self.max_output_size] + f"\n... (truncated at {self.max_output_size} chars)"
            if len(stderr) > self.max_output_size:
                stderr = stderr[: self.max_output_size] + f"\n... (truncated at {self.max_output_size} chars)"

            return {
                "command": command,
                "success": process.returncode == 0,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": process.returncode
            }

        except Exception as exc:
            logger.error(f"Error executing command '{command}': {exc}")
            return {
                "command": command,
                "success": False,
                "stdout": "",
                "stderr": str(exc),
                "exit_code": -1
            }

    def get_file_tree(self, max_depth: int = 6) -> list[dict[str, Any]]:
        """Return a nested JSON tree representation of the codebase."""
        def build_tree(current_dir: Path, current_depth: int) -> list[dict[str, Any]]:
            if current_depth > max_depth:
                return []
            items = []
            try:
                for entry in sorted(current_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                    if entry.name in IGNORED_DIRS or entry.name in IGNORED_FILES:
                        continue
                    if entry.name.startswith(".") and entry.is_dir():
                        continue

                    rel_path = str(entry.relative_to(self.working_directory))
                    if entry.is_dir():
                        children = build_tree(entry, current_depth + 1)
                        items.append({
                            "name": entry.name,
                            "path": rel_path,
                            "type": "directory",
                            "children": children
                        })
                    else:
                        items.append({
                            "name": entry.name,
                            "path": rel_path,
                            "type": "file",
                            "size": entry.stat().st_size,
                            "extension": entry.suffix.lstrip(".").lower()
                        })
            except Exception as e:
                logger.warning(f"Error reading dir {current_dir}: {e}")
            return items

        return build_tree(self.working_directory, 1)

    def read_file_content(self, relative_path: str, max_lines: int = 1500) -> dict[str, Any]:
        """Safely read content of a specific file inside the project."""
        safe_path = (self.working_directory / relative_path).resolve()
        if not str(safe_path).startswith(str(self.working_directory)):
            raise ValueError("Access denied: Path is outside the project directory.")

        if not safe_path.exists() or not safe_path.is_file():
            raise FileNotFoundError(f"File not found: {relative_path}")

        try:
            with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
                lines = [f.readline() for _ in range(max_lines)]
                content = "".join(lines)
                is_truncated = bool(f.readline())
            
            return {
                "path": relative_path,
                "name": safe_path.name,
                "extension": safe_path.suffix.lstrip(".").lower(),
                "content": content,
                "lines_count": len(lines),
                "is_truncated": is_truncated,
                "size_bytes": safe_path.stat().st_size
            }
        except Exception as e:
            return {
                "path": relative_path,
                "name": safe_path.name,
                "extension": safe_path.suffix.lstrip(".").lower(),
                "content": f"[Error reading file: {str(e)}]",
                "lines_count": 0,
                "is_truncated": False,
                "size_bytes": 0
            }

    def get_project_stats(self) -> dict[str, Any]:
        """Calculate statistics about the project."""
        total_files = 0
        total_size = 0
        extensions: dict[str, int] = {}

        for root, dirs, files in os.walk(self.working_directory):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
            for file in files:
                if file in IGNORED_FILES or file.startswith("."):
                    continue
                file_path = Path(root) / file
                try:
                    size = file_path.stat().st_size
                    total_files += 1
                    total_size += size
                    ext = file_path.suffix.lstrip(".").lower() or "other"
                    extensions[ext] = extensions.get(ext, 0) + 1
                except Exception:
                    pass

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "languages": sorted(extensions.items(), key=lambda x: x[1], reverse=True)[:8]
        }
