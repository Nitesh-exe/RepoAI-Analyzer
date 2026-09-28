"""
Interactive Codebase Chat Assistant for the IDE Dashboard.
Enables developers to chat with an AI agent about their specific codebase.
"""
import logging
from typing import Any
from .gemini_client import GeminiClient
from .shell_tool import SecureExplorer

logger = logging.getLogger(__name__)

CHAT_SYSTEM_PROMPT = """You are RepoAI Assistant, an expert AI software engineer embedded in an IDE dashboard.
The user is viewing and working with a codebase. You have direct access to their project structure and code.

YOUR GOAL:
Provide precise, helpful, and technically authoritative answers about this codebase.

GUIDELINES:
1. Reference exact file paths (e.g. `src/components/Navbar.tsx`, `backend/views.py`).
2. Provide code snippets with syntax highlighting whenever answering how to do something or explaining logic.
3. Be concise and direct: explain architecture, locate definitions, pinpoint bugs, and suggest improvements.
4. If asked to write or refactor code, write production-ready code matching the project's existing style.
"""


class CodebaseChatEngine:
    """Handles interactive conversational queries about the project."""

    def __init__(self, working_directory: str, api_key: str | None = None):
        self.working_directory = working_directory
        self.gemini = GeminiClient(api_key=api_key)
        self.shell_tool = SecureExplorer(working_directory=working_directory)

    def chat(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        active_file_path: str | None = None,
    ) -> dict[str, Any]:
        """
        Process user question with codebase context and active file context.
        """
        context_parts = []

        # Include basic project stats
        try:
            stats = self.shell_tool.get_project_stats()
            langs = ", ".join(f"{ext} ({cnt})" for ext, cnt in stats.get("languages", [])[:4])
            context_parts.append(f"PROJECT OVERVIEW: {stats.get('total_files', 0)} files. Main languages: {langs}")
        except Exception:
            pass

        # If user has an active file open in the IDE editor, inject its content!
        if active_file_path:
            try:
                file_info = self.shell_tool.read_file_content(active_file_path, max_lines=400)
                context_parts.append(
                    f"CURRENTLY OPEN FILE IN EDITOR ({active_file_path}):\n"
                    f"```{file_info.get('extension', '')}\n"
                    f"{file_info.get('content', '')}\n"
                    f"```"
                )
            except Exception as e:
                logger.warning(f"Could not read active file {active_file_path}: {e}")

        # If question seems to ask for specific files or patterns, run a quick targeted search
        lower_msg = message.lower()
        if any(term in lower_msg for term in ["where is", "find", "search", "routes", "database", "auth", "api"]):
            search_cmd = "find . -maxdepth 3 -not -path '*/.*' | head -35"
            res = self.shell_tool.execute_command(search_cmd)
            if res.get("success") and res.get("stdout"):
                context_parts.append(f"REPOSITORY STRUCTURE HIGHLIGHTS:\n{res.get('stdout')[:1500]}")

        # Assemble prompt with history
        history_text = ""
        if history:
            history_lines = []
            for h in history[-6:]:  # last 6 turns
                role = "User" if h.get("role") == "user" else "Assistant"
                history_lines.append(f"{role}: {h.get('content', '')}")
            history_text = "\n".join(history_lines)

        full_prompt = f"""
{chr(10).join(context_parts)}

CONVERSATION HISTORY:
{history_text or "No previous messages."}

USER QUERY:
{message}
"""
        response_text = self.gemini.generate_text(
            prompt=full_prompt,
            system_instruction=CHAT_SYSTEM_PROMPT,
            temperature=0.3,
            max_output_tokens=3000,
        )

        return {
            "message": response_text,
            "active_file": active_file_path,
        }
