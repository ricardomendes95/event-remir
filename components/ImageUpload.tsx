"use client";

import React, { useRef, useState } from "react";
import { Upload, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { useImageUpload } from "../hooks/useImageUpload";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | null) => void;
  className?: string;
  accept?: string;
  maxSize?: number; // em MB
  preview?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  className = "",
  accept = "image/jpeg,image/png,image/webp",
  maxSize = 5,
  preview = true,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { uploading, progress, error, uploadImage, reset } = useImageUpload();

  const handleFileSelect = async (file: File) => {
    const url = await uploadImage(file);
    if (url) {
      onChange(url);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeImage = () => {
    onChange(null);
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Área de Upload */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-colors
          ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300"}
          ${
            uploading
              ? "opacity-50 pointer-events-none"
              : "cursor-pointer hover:border-gray-400"
          }
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="text-center">
          {uploading ? (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600 animate-pulse" />
              </div>
              <p className="text-sm text-gray-600">Enviando imagem...</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{progress}%</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Clique para enviar ou arraste uma imagem
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, WebP até {maxSize}MB
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Preview da Imagem */}
      {preview && value && !uploading && (
        <div className="relative">
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg border"
            />

            {/* Overlay com botão de remover */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Informações da imagem */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center space-x-1">
              <ImageIcon className="w-3 h-3" />
              <span>Imagem carregada</span>
            </span>
            <button
              type="button"
              onClick={removeImage}
              className="text-red-600 hover:text-red-700"
            >
              Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
