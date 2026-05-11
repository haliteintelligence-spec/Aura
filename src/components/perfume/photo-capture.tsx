"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import Image from "next/image";
import type { PerfumeSearchResult } from "@/lib/types";

interface PhotoCaptureProps {
  onResult: (candidates: PerfumeSearchResult[]) => void;
}

export function PhotoCapture({ onResult }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/perfume/identify", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      onResult(data.candidates || []);
    } catch {
      onResult([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden aspect-square max-w-48 mx-auto border border-border">
          <Image src={preview} alt="Perfume" fill className="object-contain" unoptimized />
          {loading && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          <button
            onClick={() => setPreview(null)}
            className="absolute top-2 right-2 bg-background/80 rounded-full p-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-24 flex-col gap-2 border-dashed border-2"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="w-6 h-6 text-primary" />
            <span className="text-xs">Take Photo</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-24 flex-col gap-2 border-dashed border-2"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-6 h-6 text-primary" />
            <span className="text-xs">Upload</span>
          </Button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
