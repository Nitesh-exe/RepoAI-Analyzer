from django.urls import path

from .views import upload_project


urlpatterns = [
    path(
        "upload/",
        upload_project,
        name="upload-project",
    ),
]