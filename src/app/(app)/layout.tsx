import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopNav from '@/components/navigation/TopNav'
import BottomNav from '@/components/navigation/BottomNav'

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/auth')
    }

    // Check if onboarding is complete
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single()

    // If profile doesn't exist or onboarding is incomplete
    if (error || !profile?.onboarding_complete) {
        redirect('/onboarding')
    }

    return (
        <>
            <TopNav />
            {children}
            <BottomNav />
        </>
    )
}
