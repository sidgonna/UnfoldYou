'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import styles from './SearchBar.module.css'

interface SearchBarProps {
    placeholder?: string
    onSearch: (query: string) => void
    debounceMs?: number
}

export default function SearchBar({
    placeholder = 'Search...',
    onSearch,
    debounceMs = 300,
}: SearchBarProps) {
    const [value, setValue] = useState('')
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const debouncedSearch = useCallback(
        (query: string) => {
            if (timerRef.current) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                onSearch(query)
            }, debounceMs)
        },
        [onSearch, debounceMs]
    )

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setValue(newValue)
        debouncedSearch(newValue)
    }

    const handleClear = () => {
        setValue('')
        onSearch('')
    }

    return (
        <div className={styles['search-bar']}>
            <span className={styles['search-icon']}>🔍</span>
            <input
                type="text"
                className={styles['search-input']}
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
            />
            {value && (
                <button
                    className={styles['clear-btn']}
                    onClick={handleClear}
                    type="button"
                >
                    ✕
                </button>
            )}
        </div>
    )
}
