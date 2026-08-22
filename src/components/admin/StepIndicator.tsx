'use client'

const STEPS = ['Metadata', 'Grid Editor', 'Clues', 'Preview & Publish']

export default function StepIndicator({ current }: { current: number }) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const isDone = i < current
        const isActive = i === current
        return (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-ink'
                  : isDone
                  ? 'bg-accent-soft text-accent-soft-ink'
                  : 'bg-sunken text-ink-soft'
              }`}
            >
              <span className="text-xs">{isDone ? '✓' : i + 1}</span>
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px ${isDone ? 'bg-accent' : 'bg-line'}`} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
