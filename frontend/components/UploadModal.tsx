"use client";

import { supabase } from "@/lib/supabase";
import { useRef, useState } from "react";
import {
  Upload,
  X,
  FileArchive,
  Check,
  AlertCircle,
} from "lucide-react";

interface UploadModalProps {
  onClose: () => void;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export default function UploadModal({
  onClose,
}: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const validateFile = (selectedFile: File) => {
    setError("");

    const isZip =
      selectedFile.name.toLowerCase().endsWith(".zip") ||
      selectedFile.type === "application/zip" ||
      selectedFile.type === "application/x-zip-compressed";

    if (!isZip) {
      setFile(null);
      setError("Only ZIP files are supported.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The project ZIP must be smaller than 100 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      validateFile(selectedFile);
    }
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    setDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];

    if (droppedFile) {
      validateFile(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError(
          "Your session has expired. Please log in again."
        );

        return;
      }

      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        "http://localhost:8000/api/projects/upload/",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },

          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Failed to upload project."
        );

        return;
      }

      console.log(
        "Project uploaded:",
        data
      );

      onClose();

      window.location.reload();

    } catch (error) {
      console.error(error);

      setError(
        "Unable to connect to the backend."
      );
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="upload-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="upload-modal-header">
          <div>
            <span className="section-label">
              NEW PROJECT
            </span>

            <h2>Upload project</h2>

            <p>
              Upload a ZIP containing your codebase.
            </p>
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {!file ? (
          <div
            className={`drop-zone ${
              dragging ? "drop-zone-active" : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">
              <Upload
                size={20}
                strokeWidth={1.8}
              />
            </div>

            <strong>
              Drop your project ZIP here
            </strong>

            <span>
              or click to browse your device
            </span>

            <small>
              ZIP files only · Maximum 100 MB
            </small>

            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="selected-file">
            <div className="selected-file-icon">
              <FileArchive size={19} />
            </div>

            <div className="selected-file-info">
              <strong>{file.name}</strong>

              <span>
                {formatFileSize(file.size)}
              </span>
            </div>

            <div className="file-valid">
              <Check size={15} />
            </div>

            <button
              type="button"
              className="remove-file"
              onClick={() => {
                setFile(null);
                setError("");

                if (inputRef.current) {
                  inputRef.current.value = "";
                }
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {error && (
          <div className="upload-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="upload-info">
          <div>
            <strong>100 MB maximum</strong>

            <span>
              Files such as node_modules, .git, .env,
              venv and .venv will be excluded.
            </span>
          </div>
        </div>

        <div className="upload-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="upload-button"
            disabled={!file}
            onClick={handleUpload}
          >
            <Upload size={15} />

            Upload project
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}