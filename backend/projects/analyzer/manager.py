"""
Agent Manager orchestrating multi-agent collaboration with review cycles.
Coordinates CodeAnalyzer and TaskSpecialist for robust codebase understanding.
"""
import logging
from typing import Any
from .gemini_client import GeminiClient
from .shell_tool import SecureExplorer
from .code_analyzer import CodeAnalyzer
from .task_specialist import TaskSpecialist

logger = logging.getLogger(__name__)


class AgentManager:
    """Orchestrates multi-agent review cycles for codebase analysis."""

    def __init__(
        self,
        working_directory: str,
        api_key: str | None = None,
        max_review_cycles: int = 2,
    ):
        self.working_directory = working_directory
        self.max_review_cycles = max_review_cycles
        self.gemini = GeminiClient(api_key=api_key)
        self.shell_tool = SecureExplorer(working_directory=working_directory)
        self.code_analyzer = CodeAnalyzer(self.gemini, self.shell_tool, max_iterations=4)
        self.task_specialist = TaskSpecialist(self.gemini)

    def run_analysis(self, query: str) -> dict[str, Any]:
        """
        Execute full multi-agent analysis with review cycles.

        Returns:
            dict containing:
            - query: str
            - final_report: str
            - key_findings: list[str]
            - steps_log: list[dict]
            - review_cycles: int
            - confidence_score: float
            - status: str ('accepted' | 'forced')
            - specialist_feedback: str | None
        """
        review_count = 0
        specialist_feedback = None
        all_steps_log = []
        all_key_findings = []
        confidence_score = 0.8
        acceptance_status = "accepted"

        logger.info(f"AgentManager started analysis for query: {query}")

        last_analysis = ""

        while review_count < self.max_review_cycles:
            review_count += 1
            logger.info(f"Starting review cycle {review_count}/{self.max_review_cycles}")

            # 1. CodeAnalyzer explores codebase
            analysis_output = self.code_analyzer.analyze(
                query=query,
                specialist_feedback=specialist_feedback,
            )

            last_analysis = analysis_output.get("analysis_text", "")
            all_steps_log.extend(analysis_output.get("steps_log", []))
            all_key_findings = analysis_output.get("key_findings", [])
            analyzer_conf = analysis_output.get("confidence", 0.75)

            # 2. TaskSpecialist reviews completeness
            is_complete, feedback, spec_confidence = self.task_specialist.review_analysis(
                analysis_report=last_analysis,
                task_query=query,
                review_round=review_count,
            )

            confidence_score = (analyzer_conf + spec_confidence) / 2.0

            if is_complete or review_count >= self.max_review_cycles:
                acceptance_status = "accepted" if is_complete else "forced"
                specialist_feedback = feedback
                break
            else:
                specialist_feedback = feedback

        return {
            "query": query,
            "final_report": last_analysis,
            "key_findings": all_key_findings,
            "steps_log": all_steps_log,
            "review_cycles": review_count,
            "confidence_score": round(confidence_score, 2),
            "status": acceptance_status,
            "specialist_feedback": specialist_feedback,
        }
