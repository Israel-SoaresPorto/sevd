import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Configurações</h1>
    </div>
  )
}