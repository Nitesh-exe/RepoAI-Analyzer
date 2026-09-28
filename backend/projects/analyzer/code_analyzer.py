"""
Code Analyzer Agent for progressive codebase understanding.
Iteratively explores the codebase using secure shell commands and builds technical knowledge.
"""
import logging
from typing import Any
from .gemini_client import GeminiClient
from .shell_tool import SecureExplorer

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = r"""You are a Code Analyzer, a world-class technical expert responsible for comprehensive codebase analysis.

CRITICAL: You MUST always start by exploring the codebase with shell commands before providing any final analysis.

Your capabilities:
- Multi-round iterative exploration of the repository
- Executing read-only shell commands (ls, find, cat, head, tail, grep, wc, file)
- Building knowledge incrementally across iterations
- Tracking key findings as a shared knowledge base

DISCOVERY-DRIVEN ANALYSIS PHILOSOPHY:
Be a detective. Let curiosity and actual code findings guide your investigation.
1. Discovery Phase: Inspect structure (find, ls, check package.json, requirements.txt, tsconfig, etc.)
2. Pattern Recognition: Locate routes, models, business logic, handlers, entry points.
3. Deep Understanding: Read core files, inspect data flow, error handling, configs.
4. Concrete Evidence: Every statement MUST be backed by actual file paths, function names, and line numbers.

Only use safe read-only commands:
- find, ls, tree
- cat, head, tail
- grep (with -r, -n, -E)
- wc, file, stat

RESPONSE FORMAT:
You MUST respond in valid JSON format with these exact fields:
{
    "need_shell_execution": true/false,
    "shell_commands": ["command1", "command2"],
    "key_findings": ["Finding 1 with file names", "Finding 2"],
    "current_analysis": "Summary of findings and technical deductions so far",
    "confidence_level": 1-10,
    "next_focus_areas": "What specific components or questions to investigate next"
}
"""


class CodeAnalyzer:
    """Agent responsible for technical exploration and progressive analysis of a codebase."""

    def __init__(self, gemini_client: GeminiClient, shell_tool: SecureExplorer, max_iterations: int = 5):
        self.gemini = gemini_client
        self.shell_tool = shell_tool
        self.max_iterations = max_iterations

    def analyze(
        self,
        query: str,
        specialist_feedback: str | None = None
    ) -> dict[str, Any]:
        """
        Execute multi-round self-iteration to progressively understand and analyze the codebase.
        Returns:
            dict containing:
            - analysis_text: str
            - key_findings: list[str]
            - steps_log: list[dict]
            - confidence: float
        """
        iteration = 0
        shared_key_findings: list[str] = []
        shell_history: list[dict[str, Any]] = []
        analysis_context: list[dict[str, Any]] = []
        steps_log: list[dict[str, Any]] = []

        logger.info(f"CodeAnalyzer starting analysis for: {query}")

        while iteration < self.max_iterations:
            iteration += 1

            prompt = self._build_prompt(
                query=query,
                iteration=iteration,
                shared_key_findings=shared_key_findings,
                shell_history=shell_history,
                analysis_context=analysis_context,
                specialist_feedback=specialist_feedback,
            )

            try:
                decision = self.gemini.generate_json(
                    prompt=prompt,
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.2,
                )
            except Exception as e:
                logger.error(f"Error calling Gemini in iteration {iteration}: {e}")
                decision = {
                    "need_shell_execution": False,
                    "shell_commands": [],
                    "key_findings": shared_key_findings,
                    "current_analysis": f"Encountered analysis error: {e}",
                    "confidence_level": 5,
                    "next_focus_areas": "Finalize analysis"
                }

            # Update shared key findings
            if isinstance(decision.get("key_findings"), list):
                shared_key_findings = decision["key_findings"]

            need_shell = decision.get("need_shell_execution", True)
            commands = decision.get("shell_commands", [])

            # First iteration must explore if no commands provided
            if iteration == 1 and not commands:
                commands = ["find . -maxdepth 3 -not -path '*/.*' | head -30", "ls -la"]
                need_shell = True

            cmd_results = []
            if need_shell and commands:
                for cmd in commands[:4]:  # limit to 4 commands per round
                    res = self.shell_tool.execute_command(cmd)
                    cmd_results.append(res)
                    steps_log.append({
                        "iteration": iteration,
                        "command": cmd,
                        "success": res.get("success", False),
                        "output_preview": (res.get("stdout") or res.get("stderr") or "")[:400]
                    })

                shell_history.append({
                    "iteration": iteration,
                    "results": cmd_results
                })

            analysis_context.append({
                "iteration": iteration,
                "current_analysis": decision.get("current_analysis", ""),
                "confidence": decision.get("confidence_level", 5),
                "next_focus": decision.get("next_focus_areas", "")
            })

            confidence = decision.get("confidence_level", 5)

            # Check if ready to terminate early
            if not need_shell or confidence >= 8:
                logger.info(f"CodeAnalyzer converged at iteration {iteration} with confidence {confidence}")
                break

        # Generate comprehensive final synthesis
        final_report = self._synthesize_final_report(
            query=query,
            shared_key_findings=shared_key_findings,
            shell_history=shell_history,
            analysis_context=analysis_context,
            specialist_feedback=specialist_feedback,
        )

        return {
            "analysis_text": final_report,
            "key_findings": shared_key_findings,
            "steps_log": steps_log,
            "confidence": float(analysis_context[-1].get("confidence", 7)) / 10.0 if analysis_context else 0.7
        }

    def _build_prompt(
        self,
        query: str,
        iteration: int,
        shared_key_findings: list[str],
        shell_history: list[dict],
        analysis_context: list[dict],
        specialist_feedback: str | None,
    ) -> str:
        prompt_parts = [
            f"=== CODEBASE ANALYSIS - ROUND {iteration}/{self.max_iterations} ===",
            f"TASK / QUERY: {query}",
        ]

        if specialist_feedback:
            prompt_parts.append(
                f"\n⚠️ CRITICAL REVIEWER FEEDBACK TO ADDRESS:\n{specialist_feedback}\n"
                "Prioritize inspecting code that directly addresses the above gaps."
            )

        if shared_key_findings:
            prompt_parts.append("\n🧠 ACCUMULATED KEY FINDINGS:")
            for i, f in enumerate(shared_key_findings, 1):
                prompt_parts.append(f"{i}. {f}")
        else:
            prompt_parts.append("\n🧠 KEY FINDINGS: (None yet - identify architecture and files)")

        if shell_history:
            prompt_parts.append("\n📋 RECENT TOOL EXECUTION RESULTS:")
            last_execs = shell_history[-2:]
            for exec_item in last_execs:
                prompt_parts.append(f"Round {exec_item['iteration']}:")
                for r in exec_item["results"]:
                    prompt_parts.append(f"$ {r['command']}")
                    out = (r.get("stdout") or r.get("stderr") or "").strip()
                    prompt_parts.append(out[:1200] if len(out) > 1200 else (out or "(empty)"))

        if analysis_context:
            last = analysis_context[-1]
            prompt_parts.append(
                f"\nPrevious Round Focus: {last.get('next_focus', '')}\n"
                f"Previous Confidence: {last.get('confidence', 5)}/10"
            )

        prompt_parts.append(
            "\nBased on what you have discovered, formulate your next read-only commands "
            "(e.g., read key files with 'cat', search symbols with 'grep -r', check config) "
            "or conclude if you have enough information."
        )

        return "\n".join(prompt_parts)

    def _synthesize_final_report(
        self,
        query: str,
        shared_key_findings: list[str],
        shell_history: list[dict],
        analysis_context: list[dict],
        specialist_feedback: str | None,
    ) -> str:
        """Create a deep, structured markdown analysis report."""
        synthesis_prompt = f"""
You are synthesizing the final technical analysis report for the user's query.

TASK / QUERY: {query}

KEY FINDINGS DISCOVERED:
{chr(10).join(f"- {f}" for f in shared_key_findings)}

RECENT INVESTIGATIONS:
{chr(10).join(f"- Round {c['iteration']}: {c['current_analysis']}" for c in analysis_context)}

FEEDBACK ADDRESSED:
{specialist_feedback or "Initial analysis"}

FORMAT YOUR FINAL REPORT IN CLEAN, DETAILED GITHUB MARKDOWN:
1. **Executive Summary**: Clear, high-level summary directly answering the user query.
2. **Architecture & Project Structure**: Key directories, frameworks, configuration files, and role of each.
3. **Core Components & Data Flow**: Specific classes, functions, and interfaces, explaining how data moves through the system.
4. **Concrete Implementation Details**: Specific file paths, line references (or function names), and code snippets where relevant.
5. **Insights / Recommendations**: Potential pitfalls, security considerations, or next implementation steps.

REQUIREMENTS:
- Be strictly technical, concrete, and actionable.
- Cite exact file paths and component names discovered in the codebase.
- No vague marketing buzzwords.
"""
        try:
            return self.gemini.generate_text(
                prompt=synthesis_prompt,
                system_instruction="You are a senior principal engineer producing an authoritative, precise code analysis report.",
                temperature=0.2,
                max_output_tokens=4096,
            )
        except Exception as e:
            logger.error(f"Error synthesizing final report: {e}")
            return f"### Analysis for: {query}\n\n**Key Findings:**\n" + "\n".join(f"- {f}" for f in shared_key_findings)
