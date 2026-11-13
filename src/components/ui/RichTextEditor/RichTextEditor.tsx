'use client'

import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  CodeBlock,
  LinkSimple,
  ListBullets,
  ListNumbers,
  Minus,
  Paragraph,
  Quotes,
  TextB,
  TextHFive,
  TextHFour,
  TextHThree,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
// Read-only: in tone="admin" the text wears the public page's own rules.
import richTextStyles from '@/components/ui/RichText/RichText.module.scss'

import styles from './RichTextEditor.module.scss'

type RichTextEditorProps = {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  variant?: 'full' | 'simple' // 'simple' shows only bold (for 3D stencils)
  /**
   * admin: the admin page editor (gallery.md §2c): a grouped toolbar of 32px
   * Phosphor buttons with names, one Tab stop and arrow keys, and the text in
   * the public RichText styles. Default: today's look, unchanged.
   */
  tone?: 'default' | 'admin'
  /** admin only: the public RichText variant the text mirrors ('page' = About and legal). */
  richTextVariant?: 'default' | 'page'
  /** admin only: ids for the editable area's aria-labelledby / aria-describedby. */
  labelledBy?: string
  describedBy?: string
  /**
   * Once, the first time the editor exists (before the content sync below):
   * its HTML for the content it was created with, i.e. TipTap's own form of
   * `content`, which the sync then reports through onChange.
   */
  onReady?: (html: string) => void
}

type ToolbarTool = {
  label: string
  title: string
  icon: PhosphorIcon
  run: () => void
  /** Toggles only (as today's aria-pressed); actions leave it undefined. */
  pressed?: boolean
  disabled?: boolean
}

type ToolbarGroup = { label: string; tools: ToolbarTool[] }

const TOOLBAR_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End']

export const RichTextEditor = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  variant = 'full',
  tone = 'default',
  richTextVariant = 'default',
  labelledBy,
  describedBy,
  onReady,
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
        // questions.md Q82: StarterKit 3 brings its own Link; the full editor adds the configured one
        // below, so it was registered twice (a TipTap warning in every editor). The simple editor
        // keeps StarterKit's, as today.
        ...(variant === 'full' ? { link: false as const } : {}),
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
      attributes:
        tone === 'admin'
          ? {
              class: c(
                styles.editorAdmin,
                richTextStyles.richText,
                richTextVariant === 'page' && richTextStyles.page,
              ),
              'aria-multiline': 'true',
              ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
              ...(describedBy ? { 'aria-describedby': describedBy } : {}),
            }
          : {
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

  // Before the sync below: effects run in order, so onReady sees the editor's
  // HTML before setContent reports anything.
  const readyRef = useRef(false)
  useEffect(() => {
    if (!editor || readyRef.current) return
    readyRef.current = true
    onReady?.(editor.getHTML())
  }, [editor, onReady])

  // tone="admin": the toolbar's one Tab stop (roving tabindex), by DOM index.
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [activeTool, setActiveTool] = useState(0)

  const toolbarButtons = () =>
    Array.from(toolbarRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])

  const onToolbarFocus = (event: FocusEvent<HTMLDivElement>) => {
    const index = toolbarButtons().indexOf(event.target as Element as HTMLButtonElement)
    if (index !== -1) setActiveTool(index)
  }

  const onToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!TOOLBAR_KEYS.includes(event.key)) return
    const buttons = toolbarButtons()
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return
    event.preventDefault()
    const enabled = buttons.filter((button) => !button.disabled)
    if (!enabled.length) return
    const position = enabled.indexOf(buttons[current])
    const next =
      event.key === 'Home'
        ? enabled[0]
        : event.key === 'End'
          ? enabled[enabled.length - 1]
          : enabled[
              (position + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
            ]
    next?.focus()
  }

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor || !editorState) {
    return null
  }

  // tone="admin" only. Each command and state is the default toolbar's below.
  const toolbarGroups: ToolbarGroup[] =
    tone === 'admin'
      ? [
          {
            label: 'Text style',
            tools: [
              {
                label: 'Bold',
                title: 'Bold (Ctrl+B)',
                icon: TextB,
                run: () => editor.chain().focus().toggleBold().run(),
                pressed: editorState.isBold,
              },
              ...(variant === 'full'
                ? [
                    {
                      label: 'Italic',
                      title: 'Italic (Ctrl+I)',
                      icon: TextItalic,
                      run: () => editor.chain().focus().toggleItalic().run(),
                      pressed: editorState.isItalic,
                    },
                    {
                      label: 'Strikethrough',
                      title: 'Strikethrough',
                      icon: TextStrikethrough,
                      run: () => editor.chain().focus().toggleStrike().run(),
                      pressed: editorState.isStrike,
                    },
                  ]
                : []),
            ],
          },
          ...(variant === 'full'
            ? [
                {
                  label: 'Block type',
                  tools: [
                    {
                      label: 'Heading 2',
                      title: 'Heading 2',
                      icon: TextHTwo,
                      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
                      pressed: editorState.isH2,
                    },
                    {
                      label: 'Heading 3',
                      title: 'Heading 3',
                      icon: TextHThree,
                      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
                      pressed: editorState.isH3,
                    },
                    {
                      label: 'Heading 4',
                      title: 'Heading 4',
                      icon: TextHFour,
                      run: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
                      pressed: editorState.isH4,
                    },
                    {
                      label: 'Heading 5',
                      title: 'Heading 5',
                      icon: TextHFive,
                      run: () => editor.chain().focus().toggleHeading({ level: 5 }).run(),
                      pressed: editorState.isH5,
                    },
                    {
                      label: 'Paragraph',
                      title: 'Paragraph',
                      icon: Paragraph,
                      run: () => editor.chain().focus().setParagraph().run(),
                      pressed: editorState.isParagraph,
                    },
                  ],
                },
                {
                  label: 'Lists',
                  tools: [
                    {
                      label: 'Bulleted list',
                      title: 'Bulleted list',
                      icon: ListBullets,
                      run: () => editor.chain().focus().toggleBulletList().run(),
                      pressed: editorState.isBulletList,
                    },
                    {
                      label: 'Numbered list',
                      title: 'Numbered list',
                      icon: ListNumbers,
                      run: () => editor.chain().focus().toggleOrderedList().run(),
                      pressed: editorState.isOrderedList,
                    },
                  ],
                },
                {
                  label: 'Insert',
                  tools: [
                    {
                      label: 'Quote',
                      title: 'Quote',
                      icon: Quotes,
                      run: () => editor.chain().focus().toggleBlockquote().run(),
                      pressed: editorState.isBlockquote,
                    },
                    {
                      label: 'Code block',
                      title: 'Code block',
                      icon: CodeBlock,
                      run: () => editor.chain().focus().toggleCodeBlock().run(),
                      pressed: editorState.isCodeBlock,
                    },
                    {
                      label: 'Divider',
                      title: 'Divider',
                      icon: Minus,
                      run: () => editor.chain().focus().setHorizontalRule().run(),
                    },
                    {
                      label: 'Link',
                      title: editorState.isLink ? 'Edit or remove link' : 'Add link',
                      icon: LinkSimple,
                      run: openLinkModal,
                      pressed: editorState.isLink,
                    },
                  ],
                },
                {
                  label: 'History',
                  tools: [
                    {
                      label: 'Undo',
                      title: 'Undo (Ctrl+Z)',
                      icon: ArrowCounterClockwise,
                      run: () => editor.chain().focus().undo().run(),
                      disabled: !editorState.canUndo,
                    },
                    {
                      label: 'Redo',
                      title: 'Redo (Ctrl+Y)',
                      icon: ArrowClockwise,
                      run: () => editor.chain().focus().redo().run(),
                      disabled: !editorState.canRedo,
                    },
                  ],
                },
              ]
            : []),
        ]
      : []
  const toolbarTools = toolbarGroups.flatMap((group) => group.tools)
  // The last focused tool keeps the Tab stop, unless it went disabled.
  const tabStop = toolbarTools[activeTool]?.disabled
    ? toolbarTools.findIndex((tool) => !tool.disabled)
    : activeTool

  return (
    <div className={tone === 'admin' ? styles.containerAdmin : styles.container}>
      {/* Toolbar */}
      {tone === 'admin' ? (
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="Formatting"
          className={styles.toolbarAdmin}
          onFocus={onToolbarFocus}
          onKeyDown={onToolbarKeyDown}
        >
          {toolbarGroups.map((group) => (
            <div
              key={group.label}
              role="group"
              aria-label={group.label}
              className={styles.toolGroup}
            >
              {group.tools.map((tool) => {
                const ToolIcon = tool.icon
                return (
                  <Button
                    key={tool.label}
                    variant="bare"
                    font="dashboard"
                    className={styles.tool}
                    onClick={tool.run}
                    disabled={tool.disabled}
                    title={tool.title}
                    aria-label={tool.label}
                    aria-pressed={tool.pressed}
                    tabIndex={toolbarTools.indexOf(tool) === tabStop ? 0 : -1}
                  >
                    <ToolIcon size={18} weight={tool.pressed ? 'fill' : 'light'} aria-hidden />
                  </Button>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
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
      )}

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
