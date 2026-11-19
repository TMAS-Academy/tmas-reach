import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'
import { ModalShell } from '../ModalShell'
import { ConfirmDialog } from '../ConfirmDialog'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Synthetic crash')
  }
  return <div>Recovered view</div>
}

describe('ErrorBoundary, ModalShell, and ConfirmDialog primitives', () => {
  it('catches rendering errors and recovers via Try again and Reset local data', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onResetData = vi.fn()

    try {
      const { getByRole, getByText, rerender } = render(
        <ErrorBoundary scope="Contacts" onResetData={onResetData}>
          <Boom shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(getByRole('alert')).toBeTruthy()
      expect(getByText('Contacts encountered an error')).toBeTruthy()
      expect(getByText('Synthetic crash')).toBeTruthy()

      fireEvent.click(getByText('Reset local data'))
      expect(onResetData).toHaveBeenCalledTimes(1)

      rerender(
        <ErrorBoundary scope="Contacts" onResetData={onResetData}>
          <Boom shouldThrow={false} />
        </ErrorBoundary>
      )

      fireEvent.click(getByText('Try again'))
      expect(getByText('Recovered view')).toBeTruthy()
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it('renders ModalShell with dialog ARIA attributes and closes on Escape and backdrop click', () => {
    const onClose = vi.fn()
    const { getByRole, getByLabelText } = render(
      <ModalShell title="Edit Contact" onClose={onClose}>
        <p>Body content</p>
      </ModalShell>
    )

    const dialog = getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Edit Contact')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.mouseDown(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)

    fireEvent.click(getByLabelText('Close dialog'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('handles ConfirmDialog confirm and cancel actions', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    const { getByText } = render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Contact"
        message="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    fireEvent.click(getByText('Delete'))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
