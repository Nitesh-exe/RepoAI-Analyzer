from django.urls import path
from .views import (
    upload_project,
    clone_github_repo,
    project_detail,
    project_file_tree,
    project_file_content,
    analyze_codebase,
    chat_with_agent,
)

urlpatterns = [
    path("upload/", upload_project, name="upload-project"),
    path("github/", clone_github_repo, name="clone-github-repo"),
    path("<uuid:project_id>/", project_detail, name="project-detail"),
    path("<uuid:project_id>/tree/", project_file_tree, name="project-file-tree"),
    path("<uuid:project_id>/file/", project_file_content, name="project-file-content"),
    path("<uuid:project_id>/analyze/", analyze_codebase, name="project-analyze"),
    path("<uuid:project_id>/chat/", chat_with_agent, name="project-chat"),
]