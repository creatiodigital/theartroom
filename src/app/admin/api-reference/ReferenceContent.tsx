'use client'

import { useState, useCallback, useMemo } from 'react'
import c from 'classnames'

import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'

import SearchFilter from './SearchFilter'

import type { ApiGroup } from '@/lib/apiReference'
import type { ParsedSchema } from '@/lib/schemaParser'

import styles from './page.module.scss'

interface ReferenceContentProps {
  apiGroups: ApiGroup[]
  schema: ParsedSchema
  totalEndpoints: number
}

const METHOD_STYLE_MAP: Record<string, string> = {
  GET: styles.methodGET,
  POST: styles.methodPOST,
  PUT: styles.methodPUT,
  DELETE: styles.methodDELETE,
  PATCH: styles.methodPATCH,
}

/** Highlight dynamic params in a route path */
function formatPath(routePath: string) {
  const parts = routePath.split(/(:[\w]+)/g)
  return parts.map((part, i) => (part.startsWith(':') ? <span key={i}>{part}</span> : part))
}

/** A model's fields scroll inside its card past this many, as today (320 px, Q87). */
const FIELDS_BEFORE_SCROLL = 12

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** A count in the toolbar: a jump to its section while that section shows, plain text otherwise. */
function CountChip({
  count,
  one,
  many,
  href,
}: {
  count: number
  one: string
  many: string
  href?: string
}) {
  const content = (
    <>
      <strong>{count}</strong> {plural(count, one, many)}
    </>
  )
  return href ? (
    <a href={href} className={c(styles.count, styles.countLink)}>
      {content}
    </a>
  ) : (
    <span className={styles.count}>{content}</span>
  )
}

/** PK / UQ next to a field name; a screen reader hears the words. */
function FieldTag({ kind }: { kind: 'pk' | 'uq' }) {
  return (
    <span className={c(styles.tag, kind === 'pk' ? styles.tagPk : styles.tagUq)}>
      <span aria-hidden>{kind === 'pk' ? 'PK' : 'UQ'}</span>
      <span className="sr-only">{kind === 'pk' ? 'primary key' : 'unique'}</span>
    </span>
  )
}

export default function ReferenceContent({
  apiGroups,
  schema,
  totalEndpoints,
}: ReferenceContentProps) {
  const [filter, setFilter] = useState('')

  const handleFilterChange = useCallback((query: string) => {
    setFilter(query.toLowerCase())
  }, [])

  // Filter API groups
  const filteredGroups = useMemo(() => {
    if (!filter) return apiGroups
    return apiGroups
      .map((group) => ({
        ...group,
        routes: group.routes.filter(
          (r) =>
            r.path.toLowerCase().includes(filter) ||
            r.methods.some((m) => m.toLowerCase().includes(filter)),
        ),
      }))
      .filter((g) => g.routes.length > 0)
  }, [apiGroups, filter])

  // Filter models
  const filteredModels = useMemo(() => {
    if (!filter) return schema.models
    return schema.models.filter(
      (m) =>
        m.name.toLowerCase().includes(filter) ||
        m.fields.some(
          (f) => f.name.toLowerCase().includes(filter) || f.type.toLowerCase().includes(filter),
        ),
    )
  }, [schema.models, filter])

  // Filter enums
  const filteredEnums = useMemo(() => {
    if (!filter) return schema.enums
    return schema.enums.filter(
      (e) =>
        e.name.toLowerCase().includes(filter) ||
        e.values.some((v) => v.toLowerCase().includes(filter)),
    )
  }, [schema.enums, filter])

  const hasResults =
    filteredGroups.length > 0 || filteredModels.length > 0 || filteredEnums.length > 0

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Developer"
        title="API & database reference"
        description="Auto-generated from route handlers and the Prisma schema."
      />

      <div className={styles.toolbar}>
        <SearchFilter onFilterChange={handleFilterChange} />

        <nav aria-label="Jump to" className={styles.counts}>
          <CountChip
            count={totalEndpoints}
            one="endpoint"
            many="endpoints"
            href={filteredGroups.length > 0 ? '#endpoints' : undefined}
          />
          <CountChip count={apiGroups.length} one="resource" many="resources" />
          <CountChip
            count={schema.models.length}
            one="model"
            many="models"
            href={filteredModels.length > 0 ? '#models' : undefined}
          />
          <CountChip
            count={schema.enums.length}
            one="enum"
            many="enums"
            href={filteredEnums.length > 0 ? '#enums' : undefined}
          />
        </nav>
      </div>

      {!hasResults && (
        <div className={styles.noResults}>No results matching &ldquo;{filter}&rdquo;</div>
      )}

      {/* ---- API Endpoints ---- */}
      {filteredGroups.length > 0 && (
        <section id="endpoints" aria-labelledby="api-endpoints-title" className={styles.section}>
          <h2 id="api-endpoints-title" className={styles.sectionTitle}>
            API endpoints
          </h2>

          <div className={styles.groupGrid}>
            {filteredGroups.map((group) => (
              <div key={group.name} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3 className={styles.groupName}>{group.name}</h3>
                  <span className={styles.cardMeta}>
                    {group.routes.length} route{group.routes.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <ul className={styles.routeList}>
                  {group.routes.map((route) => (
                    <li key={route.path + route.methods.join()} className={styles.routeItem}>
                      <div className={styles.methods}>
                        {route.methods.map((method) => (
                          <span key={method} className={METHOD_STYLE_MAP[method] || styles.method}>
                            {method}
                          </span>
                        ))}
                      </div>
                      <code className={styles.routePath}>{formatPath(route.path)}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Database Models ---- */}
      {filteredModels.length > 0 && (
        <section id="models" aria-labelledby="api-models-title" className={styles.section}>
          <h2 id="api-models-title" className={styles.sectionTitle}>
            Database models
          </h2>

          <div className={styles.modelGrid}>
            {filteredModels.map((model) => {
              const scrolls = model.fields.length > FIELDS_BEFORE_SCROLL
              return (
                <div key={model.name} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.modelName}>{model.name}</h3>
                    <span className={styles.cardMeta}>
                      {model.fieldCount} {plural(model.fieldCount, 'field', 'fields')}
                      {model.relationCount > 0 &&
                        ` · ${model.relationCount} ${plural(model.relationCount, 'relation', 'relations')}`}
                    </span>
                  </div>

                  {/* A long list scrolls in its card; focusable then, so the keyboard can scroll it. */}
                  <div
                    className={scrolls ? styles.fieldsScroll : undefined}
                    role={scrolls ? 'region' : undefined}
                    aria-label={scrolls ? `${model.name} fields` : undefined}
                    tabIndex={scrolls ? 0 : undefined}
                  >
                    <ul className={styles.fieldList}>
                      {model.fields.map((field) => (
                        <li key={field.name} className={styles.field}>
                          <span className={styles.fieldName}>{field.name}</span>
                          {field.isId && <FieldTag kind="pk" />}
                          {field.isUnique && !field.isId && <FieldTag kind="uq" />}
                          <span className={styles.fieldType}>{field.type}</span>
                          {field.defaultValue && (
                            <span className={styles.fieldDefault} title={field.defaultValue}>
                              <span className="sr-only">default </span>
                              {field.defaultValue}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ---- Enums ---- */}
      {filteredEnums.length > 0 && (
        <section id="enums" aria-labelledby="api-enums-title" className={styles.section}>
          <h2 id="api-enums-title" className={styles.sectionTitle}>
            Enums
          </h2>

          <div className={styles.enumGrid}>
            {filteredEnums.map((enumDef) => (
              <div key={enumDef.name} className={c(styles.card, styles.enumCard)}>
                <h3 className={styles.enumName}>{enumDef.name}</h3>
                <ul className={styles.enumValues}>
                  {enumDef.values.map((val) => (
                    <li key={val} className={styles.enumValue}>
                      {val}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
