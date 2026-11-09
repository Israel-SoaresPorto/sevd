import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'

const router = getRouter()

const rootElement = document.getElementById('app') as HTMLElement

const root = ReactDOM.createRoot(rootElement)
root.render(<RouterProvider router={router} />)
