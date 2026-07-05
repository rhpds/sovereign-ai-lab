import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { JurisdictionProfile } from '../lib/types'

export function useProfile(profileId: string) {
  const [profile, setProfile] = useState<JurisdictionProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(profileId)

  if (profileId !== activeId) {
    setActiveId(profileId)
    setLoading(true)
    setProfile(null)
  }

  useEffect(() => {
    let cancelled = false

    api.profiles.get(profileId)
      .then(data => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [profileId])

  return { profile, loading }
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Record<string, JurisdictionProfile>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.profiles.list()
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { profiles, loading }
}
