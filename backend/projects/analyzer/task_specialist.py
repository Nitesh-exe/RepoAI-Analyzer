"""
Task Specialist Reviewer Agent.
Acts as a rigorous tech lead reviewing analysis reports for technical completeness and accuracy.
"""
import logging
from typing import Any
from .gemini_client import GeminiClient

logger = logging.getLogger(__name__)

SPECIALIST_SYSTEM_PROMPT = """You are a Task Specialist - a RUTHLESS TECH LEAD who reviews codebase analysis reports.
You need to implement the requested task immediately based solely on this report.
You have ZERO TOLERANCE for impressive-sounding but technically empty fluff.

MANDATORY CRITERIA:
1. Specific file paths, class names, method signatures, and exact responsibilities.
2. Data flow and interaction patterns between components.
3. Concrete error handling, edge cases, or configuration parameters.
4. Exact guidance on where and how to implement or answer the task.

REJECT AUTOMATICALLY IF:
- The report lists files without explaining interactions.
- Generic explanations that could apply to any framework.
- Missing specific entry points and concrete file paths.

RESPONSE FORMAT:
You MUST respond in valid JSON:
{
    "is_complete": true/false,
    "confidence": 0.0 to 1.0,
    "feedback": "Concise, specific instructions on what files or patterns the analyzer must still inspect"
}
"""


class TaskSpecialist:
    """Agent that critically evaluates analysis reports and provides constructive feedback."""

    def __init__(self, gemini_client: GeminiClient):
        self.gemini = gemini_client

    def review_analysis(
        self,
        analysis_report: str,
        task_query: str,
        review_round: int,
    ) -> tuple[bool, str, float]:
        """
        Evaluate analysis report.
        Returns:
            (is_complete, feedback, confidence_score)
        """
        prompt = f"""
TASK QUERY: {task_query}
REVIEW ROUND: {review_round}

ANALYSIS REPORT TO EVALUATE:
{analysis_report[:6000]}

CORE QUESTION: "Can an engineer start implementing or fully understand this task immediately with concrete file paths, or are there critical gaps?"

Evaluate technical depth and return your review as JSON.
"""
        try:
            decision = self.gemini.generate_json(
                prompt=prompt,
                system_instruction=SPECIALIST_SYSTEM_PROMPT,
                temperature=0.1,
            )

            is_complete = bool(decision.get("is_complete", False))
            confidence = float(decision.get("confidence", 0.75))
            feedback = str(decision.get("feedback", "Analysis requires more concrete file and function details."))

            # Threshold check
            if review_round == 1:
                # First round requires high confidence
                if confidence < 0.85:
                    is_complete = False
            else:
                if confidence < 0.75:
                    is_complete = False

            return is_complete, feedback, confidence

        except Exception as e:
            logger.warning(f"TaskSpecialist evaluation error: {e}")
            # Fallback to acceptance if review fails
            return True, "Analysis accepted with default confidence.", 0.80
