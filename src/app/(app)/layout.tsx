import TopNav from '@/components/navigation/TopNav'
import BottomNav from '@/components/navigation/BottomNav'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <TopNav />
            {children}
            <BottomNav />
        </>
    )
}
