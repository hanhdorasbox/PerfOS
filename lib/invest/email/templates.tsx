import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components'
import { email, styles } from './theme'

// Alerty jsou informační, ne příkazy — texty popisují, že podmínka nastala
// a jaké byly hodnoty. Nikdy neformulují doporučení k obchodu (spec §7).

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
          : `${events.length} alertů z Finance OS`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.h1}>Finance OS — alert</Text>
            <Text style={styles.small}>
              Informační upozornění: níže uvedené podmínky nastaly. Není to doporučení k obchodu.
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
      <Preview>{`Nedělní digest — hodnota portfolia ${data.totalValueCzk ?? '—'}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.label}>Finance OS — nedělní digest · {data.weekLabel}</Text>
            <Text style={styles.bigNumber}>{data.totalValueCzk ?? '—'}</Text>
            {data.weeklyChangeLine && (
              <Text style={{ ...styles.text, marginTop: '6px' }}>{data.weeklyChangeLine}</Text>
            )}
          </Section>
          <DigestSection
            title="Top pohyby týdne"
            lines={data.topMovers}
            empty="Žádná cenová data za tento týden."
          />
          <DigestSection
            title="Spuštěné alerty za týden"
            lines={data.alerts}
            empty="Žádný alert tento týden."
          />
          <DigestSection
            title="Watchlist — nejblíž k target MoS"
            lines={data.watchlistTop}
            empty="Watchlist je prázdný nebo bez aktivních analýz."
          />
          <DigestSection
            title="Zastarávající analýzy (4+ měsíce)"
            lines={data.staleAnalyses}
            empty="Všechny aktivní analýzy jsou čerstvé."
          />
          <DigestSection title="Cash rezerva" lines={data.cashLines} empty="Žádná cash rezerva." />
          <Text style={styles.small}>
            Souhrn je informační — žádná z položek není doporučením k obchodu.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
