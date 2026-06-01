import React from 'react'
import ReactDOM from 'react-dom/client'
import { Activity, Brain, RotateCcw, Trophy } from 'lucide-react'
import './styles.css'

type Challenge = {
  date: string
  seed: string
  sequence: number[]
}

type ScoreEntry = {
  name: string
  score: number
  level: number
  accuracy: number
  playedAt: string
}

const colors = ['#e84a5f', '#ffb400', '#39a96b', '#20639b', '#7b2cbf', '#ef476f', '#118ab2', '#06d6a0', '#f77f00']
const labels = ['pulse', 'flare', 'mint', 'deep', 'ion', 'rose', 'wave', 'glow', 'spark']

function App() {
  const [challenge, setChallenge] = React.useState<Challenge | null>(null)
  const [leaderboard, setLeaderboard] = React.useState<ScoreEntry[]>([])
  const [level, setLevel] = React.useState(1)
  const [input, setInput] = React.useState<number[]>([])
  const [activeTile, setActiveTile] = React.useState<number | null>(null)
  const [status, setStatus] = React.useState<'ready' | 'showing' | 'playing' | 'lost'>('ready')
  const [mistakes, setMistakes] = React.useState(0)
  const [name, setName] = React.useState('Player')

  const currentSequence = React.useMemo(() => challenge?.sequence.slice(0, level + 2) ?? [], [challenge, level])
  const score = Math.max(0, level * 100 - mistakes * 25 + input.length * 5)
  const accuracy = currentSequence.length === 0 ? 100 : Math.max(0, ((input.length - mistakes) / currentSequence.length) * 100)

  React.useEffect(() => {
    Promise.all([
      fetch('/api/challenge').then((res) => res.json()),
      fetch('/api/leaderboard').then((res) => res.json()),
    ]).then(([challengeData, scores]) => {
      setChallenge(challengeData)
      setLeaderboard(scores)
    })
  }, [])

  async function playSequence() {
    if (!challenge || status === 'showing') return
    setInput([])
    setStatus('showing')
    for (const tile of currentSequence) {
      setActiveTile(tile)
      await wait(430)
      setActiveTile(null)
      await wait(140)
    }
    setStatus('playing')
  }

  function handleTile(tile: number) {
    if (status !== 'playing') return
    const expected = currentSequence[input.length]
    setActiveTile(tile)
    window.setTimeout(() => setActiveTile(null), 170)

    if (tile !== expected) {
      const nextMistakes = mistakes + 1
      setMistakes(nextMistakes)
      setStatus('lost')
      void submitScore(nextMistakes)
      return
    }

    const nextInput = [...input, tile]
    setInput(nextInput)

    if (nextInput.length === currentSequence.length) {
      setLevel((current) => Math.min(current + 1, 46))
      setInput([])
      setStatus('ready')
    }
  }

  async function submitScore(nextMistakes = mistakes) {
    const finalScore = Math.max(0, level * 100 - nextMistakes * 25 + input.length * 5)
    const finalAccuracy = Math.max(0, ((input.length - nextMistakes) / Math.max(1, currentSequence.length)) * 100)
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score: finalScore, level, accuracy: finalAccuracy }),
    })
    if (response.ok) {
      setLeaderboard(await response.json())
    }
  }

  function resetGame() {
    setLevel(1)
    setInput([])
    setMistakes(0)
    setStatus('ready')
    setActiveTile(null)
  }

  return (
    <main className="shell">
      <section className="game-panel">
        <header className="topbar">
          <div>
            <p className="kicker">Day 8</p>
            <h1>Signal Sprint</h1>
          </div>
          <div className="seed">
            <span>Daily seed</span>
            <strong>{challenge?.seed ?? 'loading'}</strong>
          </div>
        </header>

        <div className="stats">
          <Stat icon={<Brain size={18} />} label="Level" value={level.toString()} />
          <Stat icon={<Activity size={18} />} label="Score" value={score.toString()} />
          <Stat icon={<Trophy size={18} />} label="Accuracy" value={`${Math.round(accuracy)}%`} />
        </div>

        <div className="board" aria-label="Signal board">
          {colors.map((color, index) => (
            <button
              className={activeTile === index ? 'tile active' : 'tile'}
              key={color}
              onClick={() => handleTile(index)}
              style={{ '--tile-color': color } as React.CSSProperties}
              aria-label={labels[index]}
            >
              <span>{index + 1}</span>
            </button>
          ))}
        </div>

        <div className="controls">
          <button className="primary" onClick={playSequence} disabled={!challenge || status === 'showing'}>
            {status === 'showing' ? 'Watch' : status === 'playing' ? 'Replay' : 'Start'}
          </button>
          <button className="icon-button" onClick={resetGame} aria-label="Reset game" title="Reset game">
            <RotateCcw size={20} />
          </button>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={20} aria-label="Player name" />
        </div>

        <div className={`message ${status}`}>
          {status === 'ready' && `Memorize ${currentSequence.length} signals, then repeat them.`}
          {status === 'showing' && 'Watch the board.'}
          {status === 'playing' && `Your turn: ${input.length}/${currentSequence.length}`}
          {status === 'lost' && 'Missed signal. Score saved, reset to try again.'}
        </div>
      </section>

      <aside className="leaderboard">
        <h2>Leaderboard</h2>
        <ol>
          {leaderboard.length === 0 && <li className="empty">No scores yet</li>}
          {leaderboard.map((entry, index) => (
            <li key={`${entry.name}-${entry.playedAt}`}>
              <span className="rank">{index + 1}</span>
              <span className="player">{entry.name}</span>
              <span className="score">{entry.score}</span>
            </li>
          ))}
        </ol>
      </aside>
    </main>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

