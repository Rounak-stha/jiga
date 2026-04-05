import { useRef, useState } from 'react'

interface Props {
  onSubmit: (email: string, pdfFile: File | null) => void
  disabled: boolean
}

export function InputForm({ onSubmit, disabled }: Props) {
  const [email, setEmail] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | null) {
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
    }
  }

  function handleSubmit() {
    if (!email.trim() && !pdfFile) return
    onSubmit(email, pdfFile)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
            Email Thread
          </label>
          <textarea
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={disabled}
            placeholder={`Paste engineer's email here...\n\n"Hey, need 50 of these brackets, aluminum, pretty tight tolerances, needed by end of month — see attached drawing."`}
            className="w-full bg-surface border border-border rounded-md text-text font-mono text-xs leading-relaxed p-3.5 resize-none min-h-44 outline-none focus:border-accent transition-colors placeholder:text-muted/50 disabled:opacity-40"
          />
        </div>

        {/* PDF upload */}
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
            Engineering Drawing (PDF)
          </label>
          <div
            onClick={() => !disabled && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleFile(e.dataTransfer.files[0] ?? null)
            }}
            className={`min-h-44 border rounded-md flex flex-col items-center justify-center text-center p-5 cursor-pointer transition-all ${
              dragging
                ? 'border-accent bg-accent/5'
                : pdfFile
                ? 'border-accent2/50 bg-accent2/5'
                : 'border-border border-dashed bg-surface hover:border-accent/50'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-3xl mb-2 opacity-50">{pdfFile ? '📐' : '⬆'}</span>
            {pdfFile ? (
              <>
                <p className="font-mono text-[11px] text-accent2 font-medium break-all">{pdfFile.name}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setPdfFile(null) }}
                  className="mt-2 font-mono text-[10px] text-muted hover:text-danger transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <p className="font-mono text-[11px] text-muted">
                Drop PDF drawing here<br />or click to browse
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || (!email.trim() && !pdfFile)}
        className="w-full py-4 bg-accent text-bg font-sans text-sm font-bold uppercase tracking-widest rounded-md transition-all hover:bg-accent/90 hover:-translate-y-px active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
      >
        {disabled ? 'Processing…' : 'Process RFQ →'}
      </button>
    </div>
  )
}
