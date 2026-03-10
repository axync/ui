import { ImageResponse } from 'next/og'

export const alt = 'Axync — Cross-Chain Settlement'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#08080C',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 600,
            height: 600,
            borderRadius: 300,
            backgroundColor: 'rgba(96,165,250,0.06)',
            top: 15,
            left: 300,
            display: 'flex',
          }}
        />

        <svg
          width="80"
          height="100"
          viewBox="0 0 120 150"
          fill="none"
          style={{ marginBottom: 32 }}
        >
          <line x1="60" y1="10" x2="20" y2="140" stroke="#CBD5E1" strokeWidth="6" strokeLinecap="round" />
          <line x1="60" y1="10" x2="100" y2="140" stroke="#CBD5E1" strokeWidth="6" strokeLinecap="round" />
          <line x1="37" y1="70" x2="83" y2="100" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />
          <line x1="83" y1="70" x2="37" y2="100" stroke="#CBD5E1" strokeWidth="5" strokeLinecap="round" />
        </svg>

        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#F1F5F9',
            letterSpacing: '-0.02em',
            display: 'flex',
          }}
        >
          Axync
        </div>

        <div
          style={{
            fontSize: 24,
            color: '#94A3B8',
            marginTop: 16,
            display: 'flex',
          }}
        >
          Cross-Chain Settlement App
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 40,
          }}
        >
          {['ZK Verified', 'No Bridge', 'Gas Only'].map((tag) => (
            <div
              key={tag}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: '1px solid rgba(203,213,225,0.15)',
                color: '#94A3B8',
                fontSize: 16,
                display: 'flex',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
