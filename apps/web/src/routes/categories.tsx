import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/categories')({ component: CategoriesPage })

function CategoriesPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Categorias</h1>
    </div>
  )
}