import { useCallback, useState } from "react";

export type UploadedFile = {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  previewUrl?: string;
};

export type FileUploadState = {
  files: UploadedFile[];
  uploading: boolean;
  error: string | null;
};

const isImageMime = (mime: string) =>
  mime.startsWith("image/") && !mime.includes("svg");

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export const formatFileReference = (file: UploadedFile): string => {
  if (isImageMime(file.mimeType)) {
    return `[Attached image: ${file.filename} (${formatFileSize(file.size)})]`;
  }
  return `[Attached file: ${file.filename} (${formatFileSize(file.size)})]`;
};

export const buildMessageWithFiles = (
  message: string,
  files: UploadedFile[]
): string => {
  if (files.length === 0) return message;
  const refs = files.map(formatFileReference).join("\n");
  const trimmed = message.trim();
  if (!trimmed) return refs;
  return `${refs}\n\n${trimmed}`;
};

let nextId = 0;

export function useFileUpload(agentId: string) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("agentId", agentId);

        const response = await fetch("/api/runtime/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Upload failed.");
        }

        const data = (await response.json()) as {
          path: string;
          filename: string;
          size: number;
          mimeType: string;
        };

        const uploaded: UploadedFile = {
          id: `upload-${++nextId}`,
          filename: data.filename,
          path: data.path,
          size: data.size,
          mimeType: data.mimeType,
          previewUrl: isImageMime(data.mimeType)
            ? URL.createObjectURL(file)
            : undefined,
        };

        setFiles((prev) => [...prev, uploaded]);
        return uploaded;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setError(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [agentId]
  );

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      for (const file of arr) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      for (const file of prev) {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      }
      return [];
    });
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    files,
    uploading,
    error,
    uploadFile,
    uploadFiles,
    removeFile,
    clearFiles,
    clearError,
  };
}
