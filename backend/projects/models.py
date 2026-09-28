from django.db import models


class Project(models.Model):
    SOURCE_CHOICES = [
        ("upload", "Upload"),
        ("github", "GitHub"),
    ]

    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    name = models.CharField(max_length=255)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    repository_url = models.URLField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_accessed_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "projects"

    def __str__(self):
        return self.name