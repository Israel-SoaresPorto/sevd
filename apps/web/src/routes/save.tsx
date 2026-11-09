import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/save')({ component: SaveCapturePage })

function SaveCapturePage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Salvar Link</h1>
    </div>
  )
}