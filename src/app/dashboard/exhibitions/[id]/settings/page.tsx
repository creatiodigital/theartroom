import { ExhibitionSettingsPage } from '@/components/dashboard/exhibitions/settings'

interface ExhibitionSettingsProps {
  params: Promise<{ id: string }>
}

const ExhibitionSettings = async ({ params }: ExhibitionSettingsProps) => {
  const { id } = await params
  return <ExhibitionSettingsPage exhibitionId={id} />
}

export default ExhibitionSettings
