'use client'

import { useState, useCallback, useMemo } from 'react'

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
    <div className={styles.container}>
      <a href="/dashboard" className={styles.backLink}>
        ← Dashboard
      </a>

      <header className={styles.header}>
        <h1 className={styles.title}>API &amp; Database Reference</h1>
        <p className={styles.subtitle}>Auto-generated from route handlers and Prisma schema</p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalEndpoints}</span> endpoints
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{apiGroups.length}</span> resources
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{schema.models.length}</span> models
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{schema.enums.length}</span> enums
          </div>
        </div>
      </header>

      <SearchFilter onFilterChange={handleFilterChange} />

      {!hasResults && (
        <div className={styles.noResults}>No results matching &ldquo;{filter}&rdquo;</div>
      )}

      {/* ---- API Endpoints ---- */}
      {filteredGroups.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>API Endpoints</h2>

          {filteredGroups.map((group) => (
            <div key={group.name} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName}>{group.name}</span>
                <span className={styles.groupCount}>
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
                    <span className={styles.routePath}>{formatPath(route.path)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* ---- Database Models ---- */}
      {filteredModels.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Database Models</h2>

          <div className={styles.modelGrid}>
            {filteredModels.map((model) => (
              <div key={model.name} className={styles.model}>
                <div className={styles.modelHeader}>
                  <span className={styles.modelName}>{model.name}</span>
                  <div className={styles.modelMeta}>
                    <span>{model.fieldCount} fields</span>
                    {model.relationCount > 0 && (
                      <span>
                        {model.relationCount} relation{model.relationCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.fieldList}>
                  {model.fields.map((field) => (
                    <div key={field.name} className={styles.field}>
                      <span
                        className={
                          field.isId
                            ? styles.fieldNameId
                            : field.isRelation
                              ? styles.fieldNameRelation
                              : styles.fieldName
                        }
                      >
                        {field.name}
                        {field.isId && <span className={styles.badgeId}>PK</span>}
                        {field.isUnique && !field.isId && (
                          <span className={styles.badgeUnique}>UQ</span>
                        )}
                      </span>
                      <span className={styles.fieldType}>{field.type}</span>
                      {field.defaultValue && (
                        <span className={styles.fieldDefault} title={field.defaultValue}>
                          = {field.defaultValue}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Enums ---- */}
      {filteredEnums.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Enums</h2>

          <div className={styles.enumGrid}>
            {filteredEnums.map((enumDef) => (
              <div key={enumDef.name} className={styles.enum}>
                <div className={styles.enumHeader}>{enumDef.name}</div>
                <div className={styles.enumValues}>
                  {enumDef.values.map((val) => (
                    <span key={val} className={styles.enumValue}>
                      {val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
