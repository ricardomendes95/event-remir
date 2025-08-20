"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import LineHeight from "./LineHeight";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { Button, Space, Divider, Tooltip } from "antd";
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  HighlightOutlined,
  LinkOutlined,
  UndoOutlined,
  RedoOutlined,
} from "@ant-design/icons";

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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-500 hover:text-blue-700 underline",
        },
      }),
      LineHeight,
    ],
    content: value,
    immediatelyRender: false, // Fix SSR hydration issues
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Se o conteúdo é apenas um parágrafo vazio, retorna string vazia
      if (html === "<p></p>") {
        onChange?.("");
      } else {
        onChange?.(html);
      }
    },
    editable: !disabled,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[${
          rows * 24
        }px] p-3`,
        placeholder: placeholder,
      },
    },
  });

  const handleLineHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (editor) {
      editor.chain().focus().setLineHeight(value).run();
    }
  };

  // Atualiza o editor quando o value externo muda
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded-lg">
        <div className="bg-gray-50 border-b border-gray-200 p-2 h-[48px]" />
        <div
          className="p-3 bg-gray-50 animate-pulse"
          style={{ minHeight: `${rows * 24}px` }}
        >
          Carregando editor...
        </div>
      </div>
    );
  }

  const addLink = () => {
    const url = window.prompt("URL:");
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  };

  const currentCharCount = editor.getText().length;
  const isOverLimit = maxLength && currentCharCount > maxLength;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap items-center gap-2">
        {/* Espaçamento entre linhas */}
        <Tooltip title="Espaçamento entre linhas">
          <select
            className="border rounded px-1 py-0.5 text-xs"
            onChange={handleLineHeightChange}
            disabled={disabled}
            value={editor.getAttributes("paragraph").lineHeight || "1.5"}
            style={{ minWidth: 60 }}
          >
            <option value="1">Simples</option>
            <option value="1.5">1.5</option>
            <option value="2">Duplo</option>
            <option value="2.5">2.5</option>
            <option value="3">3</option>
          </select>
        </Tooltip>
        <Space size="small" wrap>
          {/* Undo/Redo */}
          <Tooltip title="Desfazer">
            <Button
              type="text"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => editor.chain().focus().undo().run()}
              disabled={disabled || !editor.can().undo()}
            />
          </Tooltip>
          <Tooltip title="Refazer">
            <Button
              type="text"
              size="small"
              icon={<RedoOutlined />}
              onClick={() => editor.chain().focus().redo().run()}
              disabled={disabled || !editor.can().redo()}
            />
          </Tooltip>

          <Divider type="vertical" />

          {/* Text Formatting */}
          <Tooltip title="Negrito">
            <Button
              type={editor.isActive("bold") ? "primary" : "text"}
              size="small"
              icon={<BoldOutlined />}
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Itálico">
            <Button
              type={editor.isActive("italic") ? "primary" : "text"}
              size="small"
              icon={<ItalicOutlined />}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Sublinhado">
            <Button
              type={editor.isActive("underline") ? "primary" : "text"}
              size="small"
              icon={<UnderlineOutlined />}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Destacar">
            <Button
              type={editor.isActive("highlight") ? "primary" : "text"}
              size="small"
              icon={<HighlightOutlined />}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              disabled={disabled}
            />
          </Tooltip>

          <Divider type="vertical" />

          {/* Lists */}
          <Tooltip title="Lista com marcadores">
            <Button
              type={editor.isActive("bulletList") ? "primary" : "text"}
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Lista numerada">
            <Button
              type={editor.isActive("orderedList") ? "primary" : "text"}
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              disabled={disabled}
            />
          </Tooltip>

          <Divider type="vertical" />

          {/* Text Alignment */}
          <Tooltip title="Alinhar à esquerda">
            <Button
              type={
                editor.isActive({ textAlign: "left" }) ||
                (!editor.isActive({ textAlign: "center" }) &&
                  !editor.isActive({ textAlign: "right" }))
                  ? "primary"
                  : "text"
              }
              size="small"
              icon={<AlignLeftOutlined />}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Centralizar">
            <Button
              type={
                editor.isActive({ textAlign: "center" }) ? "primary" : "text"
              }
              size="small"
              icon={<AlignCenterOutlined />}
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              disabled={disabled}
            />
          </Tooltip>
          <Tooltip title="Alinhar à direita">
            <Button
              type={
                editor.isActive({ textAlign: "right" }) ? "primary" : "text"
              }
              size="small"
              icon={<AlignRightOutlined />}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              disabled={disabled}
            />
          </Tooltip>

          <Divider type="vertical" />

          {/* Link */}
          <Tooltip title="Inserir link">
            <Button
              type={editor.isActive("link") ? "primary" : "text"}
              size="small"
              icon={<LinkOutlined />}
              onClick={addLink}
              disabled={disabled}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Editor */}
      <div className="relative">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none"
          style={{
            minHeight: `${rows * 24}px`,
          }}
        />

        {/* Character count */}
        {maxLength && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white px-2 py-1 rounded shadow-sm">
            <span className={isOverLimit ? "text-red-500" : ""}>
              {currentCharCount}
            </span>
            /{maxLength}
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 text-xs text-gray-500">
        Use a barra de ferramentas para formatar o texto. Suporte a negrito,
        itálico, listas, alinhamento e links.
      </div>
    </div>
  );
}
