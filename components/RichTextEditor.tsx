"use client";

import React, { useState, useRef } from "react";
import { Input, Button, Space, Tooltip } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { formatTextToHtml } from "../utils/textFormatter";

const { TextArea } = Input;

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
}

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Digite a descrição do evento...",
  rows = 6,
  maxLength = 2000,
  disabled = false,
}: RichTextEditorProps) {
  const textAreaRef = useRef<TextAreaRef>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Função para inserir formatação no texto
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea;
    if (!textArea) return;

    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    let newText;
    if (selectedText) {
      // Se há texto selecionado, aplica a formatação
      newText = `${beforeText}${prefix}${selectedText}${suffix}${afterText}`;
    } else {
      // Se não há seleção, insere os marcadores
      newText = `${beforeText}${prefix}${suffix}${afterText}`;
    }

    onChange?.(newText);

    // Restaura o foco e posição do cursor
    setTimeout(() => {
      textArea.focus();
      const newPosition = start + prefix.length + (selectedText ? selectedText.length + suffix.length : 0);
      textArea.setSelectionRange(newPosition, newPosition);
    }, 10);
  };

  // Converte texto com marcações simples para HTML
  const formattedHtml = formatTextToHtml(value);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2">
        <Space size="small">
          <Tooltip title="Negrito (**texto**)">
            <Button
              type="text"
              size="small"
              icon={<BoldOutlined />}
              onClick={() => insertFormatting("**", "**")}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Itálico (*texto*)">
            <Button
              type="text"
              size="small"
              icon={<ItalicOutlined />}
              onClick={() => insertFormatting("*", "*")}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Sublinhado (__texto__)">
            <Button
              type="text"
              size="small"
              icon={<UnderlineOutlined />}
              onClick={() => insertFormatting("__", "__")}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Lista com marcadores (- item)">
            <Button
              type="text"
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => insertFormatting("- ")}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Lista numerada (1. item)">
            <Button
              type="text"
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => insertFormatting("1. ")}
              disabled={disabled}
            />
          </Tooltip>
          <div className="border-l border-gray-300 h-4 mx-2" />
          <Button
            type="text"
            size="small"
            onClick={() => setPreviewMode(!previewMode)}
            disabled={disabled}
          >
            {previewMode ? "Editar" : "Visualizar"}
          </Button>
        </Space>
      </div>

      {/* Editor ou Preview */}
      <div className="p-0">
        {previewMode ? (
          <div
            className="min-h-[150px] p-3 bg-white prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
            style={{
              whiteSpace: 'pre-wrap',
            }}
          />
        ) : (
          <TextArea
            ref={textAreaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={`${placeholder}

Dicas de formatação:
**negrito** *itálico* __sublinhado__
- Lista com marcadores
1. Lista numerada`}
            rows={rows}
            maxLength={maxLength}
            disabled={disabled}
            bordered={false}
            showCount
            style={{
              resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            }}
          />
        )}
      </div>

      {/* Ajuda */}
      {!previewMode && (
        <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
          Use: **negrito**, *itálico*, __sublinhado__, - lista, 1. lista numerada
        </div>
      )}
    </div>
  );
}
