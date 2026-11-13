'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowSquareOut, Bank, Check, Warning } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Callout } from '@/components/admin/ui/Callout'
import { Button } from '@/components/ui/Button'

import { StudioPanel } from '@/components/dashboard/StudioPanel'
import page from '@/components/dashboard/StudioPanel/studioPage.module.scss'

import {
  createDashboardLink,
  createOnboardingLink,
  disconnectAccount,
  getConnectCountries,
  getPayoutsStatus,
  type ConnectCountry,
  type PayoutsStatus,
} from '@/app/dashboard/payouts/actions'

import styles from './Payouts.module.scss'

export const PayoutsPage = () => {
  const searchParams = useSearchParams()
  const justOnboarded = searchParams.get('onboarded') === '1'

  const [status, setStatus] = useState<PayoutsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [country, setCountry] = useState<string>('')
  const [countries, setCountries] = useState<ConnectCountry[]>([])
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  // questions.md Q124 (c): the Disconnect button says "Disconnecting…" only for its own request
  // (it did for every action, Open Stripe dashboard included).
  const [disconnecting, setDisconnecting] = useState(false)
  // Q124 (e): a countries failure is the country picker's own (it replaced any other error, on
  // every state, connected ones included).
  const [countriesError, setCountriesError] = useState<string | null>(null)
  // Display only: the dialog shows `error` once its own Disconnect was pressed,
  // so an older error (e.g. the countries one) never shows inside it.
  const [disconnectTried, setDisconnectTried] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await getPayoutsStatus()
    if (res.ok) {
      setStatus(res.status)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Countries come straight from Stripe's country_specs API (cached 24h
  // server-side) so this list never drifts from what `accounts.create`
  // will actually accept.
  useEffect(() => {
    let canceled = false
    getConnectCountries().then((res) => {
      if (canceled) return
      if (res.ok) setCountries(res.countries)
      else setCountriesError(res.error)
    })
    return () => {
      canceled = true
    }
  }, [])

  const handleConnect = useCallback(async () => {
    // If the artist already has a Connect account, country is locked and we
    // just need a fresh onboarding link — no country required from UI.
    // Otherwise we must pass the picker value.
    if (!status?.connected && !country) {
      setError('Please select your country first.')
      return
    }
    setWorking(true)
    setError(null)
    const res = await createOnboardingLink(status?.connected ? undefined : country)
    if (res.ok) {
      window.location.href = res.url
      return
    }
    setError(res.error)
    setWorking(false)
  }, [country, status?.connected])

  const handleOpenStripe = useCallback(async () => {
    // Q124 (d): Safari and pop-up blockers drop a window opened after a server round trip, so the
    // tab opens now, on the click, and goes to Stripe once the link is back (closed if it isn't).
    // Its `opener` is cut, as `noopener` did; the browser's default referrer policy sends Stripe
    // our origin only. If even this tab is blocked, the old call as a last try.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setWorking(true)
    setError(null)
    const res = await createDashboardLink()
    if (res.ok) {
      if (tab) tab.location.href = res.url
      else window.open(res.url, '_blank', 'noopener,noreferrer')
    } else {
      tab?.close()
      setError(res.error)
    }
    setWorking(false)
  }, [])

  const performDisconnect = useCallback(async () => {
    setWorking(true)
    setDisconnecting(true)
    setError(null)
    const res = await disconnectAccount()
    if (!res.ok) {
      setError(res.error)
      setWorking(false)
      setDisconnecting(false)
      return
    }
    if (res.pendingOrders > 0) {
      setError(
        `Disconnected. Heads-up: you had ${res.pendingOrders} order(s) awaiting payout — ` +
          `reconnect to receive them.`,
      )
    }
    await load()
    setConfirmingDisconnect(false)
    setWorking(false)
    setDisconnecting(false)
  }, [load])

  // statusHeadline's own "Payouts active" rule: the green tile.
  const active = !!status && status.payoutsEnabled && status.detailsSubmitted
  const TileIcon = active ? Check : Bank

  return (
    <div className={page.page}>
      <AdminPageHeader
        title="Payouts"
        description="We pay you for every sale through Stripe, straight to your bank account."
      />

      {loading && <p className={page.status}>Loading…</p>}

      {!loading && status && (
        <>
          <section aria-labelledby="payouts-status-title" className={styles.status}>
            <div className={styles.statusHead}>
              <span aria-hidden className={c(styles.tile, active && styles.tileActive)}>
                <TileIcon size={22} weight={active ? 'bold' : 'light'} />
              </span>
              <div className={styles.statusText}>
                <h2 id="payouts-status-title" className={styles.headline}>
                  {statusHeadline(status, justOnboarded)}
                </h2>
                <p className={styles.body}>{statusBody(status)}</p>
              </div>
              {status.connected && (
                <div className={styles.headAction}>
                  {renderPrimaryAction({ status, working, handleConnect, handleOpenStripe })}
                </div>
              )}
            </div>

            {/* Q124 (b): not under "Payouts active", while Stripe's webhook lags behind it. */}
            {status.connected && !active && !status.onboardingComplete && (
              <Callout tone="plain">
                Stripe updates us in the background once onboarding is complete. If this page still
                says &quot;in progress&quot; after a minute, click{' '}
                <Button variant="bare" font="dashboard" className={styles.refresh} onClick={load}>
                  refresh
                </Button>
                .
              </Callout>
            )}

            {!status.connected && (
              <>
                <div className={styles.country}>
                  <AdminSelect
                    id="payouts-country"
                    size="form"
                    label="Your country (where your bank account is)"
                    aria-describedby="payouts-country-warning"
                    value={country}
                    onChange={(v) => setCountry(v)}
                    disabled={countries.length === 0}
                  >
                    <option value="" disabled>
                      {countries.length > 0
                        ? 'Select a country…'
                        : countriesError
                          ? 'Countries unavailable'
                          : 'Loading countries…'}
                    </option>
                    {countries.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name}
                      </option>
                    ))}
                  </AdminSelect>
                  <p id="payouts-country-warning" className={styles.warning}>
                    <Warning size={14} weight="fill" aria-hidden className={styles.warningIcon} />
                    This can&apos;t be changed later. Pick the country your bank account is in.
                  </p>
                  {countriesError && (
                    <Callout tone="red" role="alert">
                      {countriesError}
                    </Callout>
                  )}
                </div>
                <div className={styles.connectRow}>
                  {renderPrimaryAction({ status, working, handleConnect, handleOpenStripe })}
                  <p className={styles.connectNote}>
                    You&apos;ll finish on Stripe&apos;s secure page, then come back here.
                  </p>
                </div>
              </>
            )}
          </section>

          {status.connected && (
            <StudioPanel
              layout="row"
              title="Disconnect"
              description="Removes your bank details from Stripe. You can reconnect anytime, useful if you need to switch country or bank."
              aside={
                <Button
                  variant="bare"
                  font="dashboard"
                  className={page.dangerOutline}
                  onClick={() => {
                    setDisconnectTried(false)
                    setConfirmingDisconnect(true)
                  }}
                  disabled={working}
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect Stripe…'}
                </Button>
              }
            />
          )}
        </>
      )}

      {error && (
        <Callout tone="red" role="alert">
          {error}
        </Callout>
      )}

      {confirmingDisconnect && (
        <AdminConfirmModal
          title="Disconnect your Stripe account?"
          message={
            <>
              {
                'Your bank details will be removed from Stripe and you’ll have to complete onboarding again if you reconnect. Any shipped orders that haven’t been paid out yet will need a new account to receive their payout.'
              }
            </>
          }
          warning={disconnectTried && !working && error ? error : undefined}
          confirmLabel="Disconnect"
          busyLabel="Disconnecting…"
          destructive
          busy={working}
          onConfirm={() => {
            setDisconnectTried(true)
            void performDisconnect()
          }}
          onCancel={() => setConfirmingDisconnect(false)}
        />
      )}
    </div>
  )
}

function statusHeadline(s: PayoutsStatus, justOnboarded: boolean) {
  if (!s.connected) return 'Not connected yet'
  if (s.payoutsEnabled && s.detailsSubmitted) return 'Payouts active'
  if (justOnboarded) return 'Finishing setup…'
  return 'Onboarding in progress'
}

function statusBody(s: PayoutsStatus) {
  if (!s.connected) {
    return 'Connect a bank account with Stripe so we can send you your share when your prints sell. Stripe handles identity verification and local banking — we never see your card or bank details.'
  }
  if (s.payoutsEnabled && s.detailsSubmitted) {
    // A real apostrophe: this is a JS string, not JSX, so an entity would show as typed (Q124 a).
    return `You’re all set. Payouts go to the bank account on file with Stripe${
      s.email ? ` (${s.email})` : ''
    }. You can update details from the Stripe dashboard.`
  }
  return 'Stripe still needs a few more details from you. Continue where you left off to finish setup.'
}

function renderPrimaryAction({
  status,
  working,
  handleConnect,
  handleOpenStripe,
}: {
  status: PayoutsStatus
  working: boolean
  handleConnect: () => void
  handleOpenStripe: () => void
}) {
  if (!status.connected) {
    return (
      <Button
        font="dashboard"
        variant="bare"
        className={c(page.primary, styles.connect)}
        label={working ? 'Opening Stripe…' : 'Connect with Stripe'}
        onClick={handleConnect}
        disabled={working}
      />
    )
  }
  if (status.payoutsEnabled && status.detailsSubmitted) {
    // Opens Stripe's dashboard in a new tab.
    return (
      <Button
        font="dashboard"
        variant="bare"
        className={page.outline}
        onClick={handleOpenStripe}
        disabled={working}
      >
        {working ? 'Opening…' : 'Open Stripe dashboard'}
        <ArrowSquareOut size={14} weight="light" aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </Button>
    )
  }
  return (
    <Button
      font="dashboard"
      variant="bare"
      className={page.primary}
      label={working ? 'Opening Stripe…' : 'Continue setup'}
      onClick={handleConnect}
      disabled={working}
    />
  )
}
