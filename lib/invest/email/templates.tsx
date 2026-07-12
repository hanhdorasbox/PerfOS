import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { email, styles } from './theme'

// Alerts are informational, not commands — the copy states that a condition
// occurred and what the values were. It never phrases a trade recommendation (spec §7).

export interface AlertEmailEvent {
  ruleName: string
  typeLabel: string
  triggeredAt: string
  lines: string[]
}

export function AlertEmail({ events }: { events: AlertEmailEvent[] }) {
  return (
    <Html lang="cs">
      <Head />
      <Preview>
        {events.length === 1
          ? `Alert: ${events[0].ruleName}`
          : `${events.length} alerts from Finance OS`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.h1}>Finance OS — alert</Text>
            <Text style={styles.small}>
              Informational notice: the conditions below occurred. This is not a trade recommendation.
            </Text>
          </Section>
          {events.map((event, i) => (
            <Section key={i} style={styles.card}>
              <Text style={{ ...styles.label, color: email.gold }}>{event.typeLabel}</Text>
              <Text style={{ ...styles.h1, fontSize: '16px' }}>{event.ruleName}</Text>
              {event.lines.map((line, j) => (
                <Text key={j} style={styles.text}>
                  {line}
                </Text>
              ))}
              <Text style={styles.small}>{event.triggeredAt}</Text>
            </Section>
          ))}
        </Container>
      </Body>
    </Html>
  )
}

export interface DigestData {
  weekLabel: string
  totalValueCzk: string | null
  weeklyChangeLine: string | null
  topMovers: string[]
  alerts: string[]
  watchlistTop: string[]
  staleAnalyses: string[]
  cashLines: string[]
}

function DigestSection({ title, lines, empty }: { title: string; lines: string[]; empty: string }) {
  return (
    <Section style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      {lines.length === 0 ? (
        <Text style={styles.small}>{empty}</Text>
      ) : (
        lines.map((line, i) => (
          <Text key={i} style={styles.text}>
            {line}
          </Text>
        ))
      )}
    </Section>
  )
}

export function DigestEmail({ data }: { data: DigestData }) {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{`Sunday digest — portfolio value ${data.totalValueCzk ?? '—'}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.label}>Finance OS — Sunday digest · {data.weekLabel}</Text>
            <Text style={styles.bigNumber}>{data.totalValueCzk ?? '—'}</Text>
            {data.weeklyChangeLine && (
              <Text style={{ ...styles.text, marginTop: '6px' }}>{data.weeklyChangeLine}</Text>
            )}
          </Section>
          <DigestSection
            title="Top movers this week"
            lines={data.topMovers}
            empty="No price data for this week."
          />
          <DigestSection
            title="Alerts triggered this week"
            lines={data.alerts}
            empty="No alerts this week."
          />
          <DigestSection
            title="Watchlist — closest to target MoS"
            lines={data.watchlistTop}
            empty="Watchlist is empty or has no active analyses."
          />
          <DigestSection
            title="Aging analyses (4+ months)"
            lines={data.staleAnalyses}
            empty="All active analyses are fresh."
          />
          <DigestSection title="Cash reserve" lines={data.cashLines} empty="No cash reserve." />
          <Text style={styles.small}>
            This summary is informational — none of the items is a trade recommendation.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
