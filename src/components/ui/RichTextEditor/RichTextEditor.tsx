'use client'

import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'

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
      ...(variant === 'full'
        ? [
            Link.configure({
              openOnClick: false,
              autolink: true,
              defaultProtocol: 'https',
              HTMLAttributes: {
                rel: 'noopener noreferrer',
              },
            }),
          ]
        : []),
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

  // Subscribe to editor state so the toolbar's active markers re-render on every
  // selection / transaction — `useEditor` alone doesn't trigger React updates.
  // Selector always returns an object so the hook never produces null.
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isStrike: ctx.editor?.isActive('strike') ?? false,
      isH2: ctx.editor?.isActive('heading', { level: 2 }) ?? false,
      isH3: ctx.editor?.isActive('heading', { level: 3 }) ?? false,
      isH4: ctx.editor?.isActive('heading', { level: 4 }) ?? false,
      isH5: ctx.editor?.isActive('heading', { level: 5 }) ?? false,
      isParagraph: ctx.editor?.isActive('paragraph') ?? false,
      isBulletList: ctx.editor?.isActive('bulletList') ?? false,
      isOrderedList: ctx.editor?.isActive('orderedList') ?? false,
      isBlockquote: ctx.editor?.isActive('blockquote') ?? false,
      isCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
      isLink: ctx.editor?.isActive('link') ?? false,
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
    }),
  })

  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpenInNewTab, setLinkOpenInNewTab] = useState(true)

  const openLinkModal = useCallback(() => {
    if (!editor) return
    const attrs = editor.getAttributes('link') as { href?: string; target?: string }
    setLinkUrl(attrs.href ?? '')
    setLinkOpenInNewTab(attrs.target ? attrs.target === '_blank' : true)
    setLinkModalOpen(true)
  }, [editor])

  const closeLinkModal = useCallback(() => {
    setLinkModalOpen(false)
    setLinkUrl('')
    setLinkOpenInNewTab(true)
  }, [])

  const handleLinkSubmit = useCallback(() => {
    if (!editor || !editorState) return
    const url = linkUrl.trim()
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      closeLinkModal()
      return
    }
    const attrs = { href: url, target: linkOpenInNewTab ? '_blank' : null }
    if (editorState.isLink) {
      editor.chain().focus().extendMarkRange('link').setLink(attrs).run()
      closeLinkModal()
      return
    }
    const { from, to } = editor.state.selection
    if (from === to) {
      // No text selected — insert the URL itself as the link text
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: url,
          marks: [{ type: 'link', attrs }],
        })
        .run()
      closeLinkModal()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink(attrs).run()
    closeLinkModal()
  }, [editor, editorState, linkUrl, linkOpenInNewTab, closeLinkModal])

  const handleLinkRemove = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    closeLinkModal()
  }, [editor, closeLinkModal])

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor || !editorState) {
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
          className={editorState.isBold ? styles.active : ''}
          title="Bold (Ctrl+B)"
          aria-pressed={editorState.isBold}
        >
          <strong>B</strong>
        </Button>

        {/* Full variant options */}
        {variant === 'full' && (
          <>
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editorState.isItalic ? styles.active : ''}
              title="Italic (Ctrl+I)"
              aria-pressed={editorState.isItalic}
            >
              <em>I</em>
            </Button>
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={editorState.isStrike ? styles.active : ''}
              title="Strikethrough"
              aria-pressed={editorState.isStrike}
            >
              <s>S</s>
            </Button>

            <span className={styles.divider} />

            {/* Headings */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editorState.isH2 ? styles.active : ''}
              title="Heading 2"
              aria-pressed={editorState.isH2}
              label="H2"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editorState.isH3 ? styles.active : ''}
              title="Heading 3"
              aria-pressed={editorState.isH3}
              label="H3"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={editorState.isH4 ? styles.active : ''}
              title="Heading 4"
              aria-pressed={editorState.isH4}
              label="H4"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
              className={editorState.isH5 ? styles.active : ''}
              title="Heading 5"
              aria-pressed={editorState.isH5}
              label="H5"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={editorState.isParagraph ? styles.active : ''}
              title="Paragraph"
              aria-pressed={editorState.isParagraph}
              label="P"
            />

            <span className={styles.divider} />

            {/* Lists */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editorState.isBulletList ? styles.active : ''}
              title="Bullet List"
              aria-pressed={editorState.isBulletList}
              label="•"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editorState.isOrderedList ? styles.active : ''}
              title="Numbered List"
              aria-pressed={editorState.isOrderedList}
              label="1."
            />

            <span className={styles.divider} />

            {/* Block elements */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={editorState.isBlockquote ? styles.active : ''}
              title="Quote"
              aria-pressed={editorState.isBlockquote}
              label={'"'}
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={editorState.isCodeBlock ? styles.active : ''}
              title="Code Block"
              aria-pressed={editorState.isCodeBlock}
              label="</>"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
              label="—"
            />
            <Button
              variant="ghost"
              icon="link"
              onClick={openLinkModal}
              className={editorState.isLink ? styles.active : ''}
              title={editorState.isLink ? 'Edit or remove link' : 'Add link'}
              aria-pressed={editorState.isLink}
            />

            <span className={styles.divider} />

            {/* Undo/Redo */}
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editorState.canUndo}
              title="Undo (Ctrl+Z)"
              label="↶"
            />
            <Button
              variant="ghost"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editorState.canRedo}
              title="Redo (Ctrl+Y)"
              label="↷"
            />
          </>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {linkModalOpen && (
        <Modal onClose={closeLinkModal} titleId="rte-link-modal-title">
          <div className={styles.linkModal}>
            <Text as="h2" weight="medium" id="rte-link-modal-title">
              {editorState.isLink ? 'Edit link' : 'Add link'}
            </Text>
            <Input
              type="url"
              size="medium"
              inputClassName={styles.linkInput}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleLinkSubmit()
                }
              }}
            />
            <Checkbox
              checked={linkOpenInNewTab}
              onChange={(e) => setLinkOpenInNewTab(e.target.checked)}
              label="Open in a new tab"
            />
            <div className={styles.linkModalActions}>
              {editorState.isLink && (
                <Button
                  variant="danger"
                  size="regularSquared"
                  onClick={handleLinkRemove}
                  label="Remove link"
                />
              )}
              <div className={styles.linkModalActionsRight}>
                <Button
                  variant="secondary"
                  size="regularSquared"
                  onClick={closeLinkModal}
                  label="Cancel"
                />
                <Button
                  variant="primary"
                  size="regularSquared"
                  onClick={handleLinkSubmit}
                  label={editorState.isLink ? 'Save' : 'Add'}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
