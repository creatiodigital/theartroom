'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'

import styles from './RichTextEditor.module.scss'

type RichTextEditorProps = {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  variant?: 'full' | 'simple' // 'simple' shows only bold (for 3D stencils)
}

export const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  variant = 'full',
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:
          variant === 'full'
            ? {
                levels: [2, 3, 4, 5, 6],
              }
            : false,
        bulletList: variant === 'full' ? {} : false,
        orderedList: variant === 'full' ? {} : false,
        blockquote: variant === 'full' ? {} : false,
        codeBlock: variant === 'full' ? {} : false,
        horizontalRule: variant === 'full' ? {} : false,
        strike: variant === 'full' ? {} : false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: styles.editor,
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Text formatting - Bold always shown */}
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? styles.active : ''}
          title="Bold (Ctrl+B)"
          aria-pressed={editor.isActive('bold')}
        >
          <strong>B</strong>
        </Button>

        {/* Full variant options */}
        {variant === 'full' && (
          <>
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? styles.active : ''}
              title="Italic (Ctrl+I)"
              aria-pressed={editor.isActive('italic')}
            >
              <em>I</em>
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={editor.isActive('strike') ? styles.active : ''}
              title="Strikethrough"
              aria-pressed={editor.isActive('strike')}
            >
              <s>S</s>
            </Button>

            <span className={styles.divider} />

            {/* Headings */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? styles.active : ''}
              title="Heading 2"
              aria-pressed={editor.isActive('heading', { level: 2 })}
              label="H2"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive('heading', { level: 3 }) ? styles.active : ''}
              title="Heading 3"
              aria-pressed={editor.isActive('heading', { level: 3 })}
              label="H3"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={editor.isActive('heading', { level: 4 }) ? styles.active : ''}
              title="Heading 4"
              aria-pressed={editor.isActive('heading', { level: 4 })}
              label="H4"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
              className={editor.isActive('heading', { level: 5 }) ? styles.active : ''}
              title="Heading 5"
              aria-pressed={editor.isActive('heading', { level: 5 })}
              label="H5"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={editor.isActive('paragraph') ? styles.active : ''}
              title="Paragraph"
              aria-pressed={editor.isActive('paragraph')}
              label="P"
            />

            <span className={styles.divider} />

            {/* Lists */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? styles.active : ''}
              title="Bullet List"
              aria-pressed={editor.isActive('bulletList')}
              label="•"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? styles.active : ''}
              title="Numbered List"
              aria-pressed={editor.isActive('orderedList')}
              label="1."
            />

            <span className={styles.divider} />

            {/* Block elements */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={editor.isActive('blockquote') ? styles.active : ''}
              title="Quote"
              aria-pressed={editor.isActive('blockquote')}
              label={'"'}
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={editor.isActive('codeBlock') ? styles.active : ''}
              title="Code Block"
              aria-pressed={editor.isActive('codeBlock')}
              label="</>"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
              label="—"
            />

            <span className={styles.divider} />

            {/* Undo/Redo */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
              label="↶"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
              label="↷"
            />
          </>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
