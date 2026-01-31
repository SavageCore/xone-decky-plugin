import React, { useState, useEffect, useRef } from 'react'
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  staticClasses,
  Spinner,
  Navigation
} from '@decky/ui'
import {
  addEventListener,
  removeEventListener,
  callable,
  definePlugin,
  toaster
} from '@decky/api'
import { FaGamepad } from 'react-icons/fa'

// Backend callable functions
const getInstallStatus = callable<
[],
{
  xone_installed: boolean
  xpad_installed: boolean
  fully_installed: boolean
  version: string
  error?: string
}
>('get_install_status')

const getPairingStatus = callable<
[],
{
  available: boolean
  pairing: boolean
  error?: string
}
>('get_pairing_status')

const installDrivers = callable<
[],
{
  success: boolean
  error?: string
  output?: string
  reboot_required?: boolean
  message?: string
}
>('install_drivers')

const uninstallDrivers = callable<
[],
{
  success: boolean
  error?: string
  output?: string
}
>('uninstall_drivers')

const enablePairing = callable<
[],
{
  success: boolean
  error?: string
}
>('enable_pairing')

const disablePairing = callable<
[],
{
  success: boolean
  error?: string
}
>('disable_pairing')

const checkForUpdates = callable<
[],
{
  update_available: boolean
  latest_version?: string
  current_version?: string
  download_url?: string
  filename?: string
  file_exists?: boolean
  release_notes?: string
  error?: string
}
>('check_for_updates')

const downloadLatestRelease = callable<
[url: string],
{
  success: boolean
  path?: string
  error?: string
}
>('download_latest_release')

const applyUpdate = callable<[], { success: boolean, error?: string }>('apply_update')

function Content (): React.ReactElement {
  const [isInstalled, setIsInstalled] = useState<boolean>(false)
  const [version, setVersion] = useState<string>('0.0.0')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isInstalling, setIsInstalling] = useState<boolean>(false)
  const [isUninstalling, setIsUninstalling] = useState<boolean>(false)
  const [pairingAvailable, setPairingAvailable] = useState<boolean>(false)
  const [isPairing, setIsPairing] = useState<boolean>(false)
  const [pairingLoading, setPairingLoading] = useState<boolean>(false)
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean
    version?: string
    url?: string
    filename?: string
    fileExists?: boolean
  }>({ available: false })
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const isPairingActionInProgress = useRef<boolean>(false)
  const lastActionTime = useRef<number>(0)

  // Check status on mount
  useEffect(() => {
    const checkStatus = async (): Promise<void> => {
      try {
        const installStatus = await getInstallStatus()
        setIsInstalled(installStatus.fully_installed)
        setVersion(installStatus.version)

        const pairingStatus = await getPairingStatus()
        setPairingAvailable(pairingStatus.available)
        setIsPairing(pairingStatus.pairing)

        // Check for updates
        const update = await checkForUpdates()
        if (update.update_available) {
          setUpdateInfo({
            available: true,
            version: update.latest_version,
            url: update.download_url,
            filename: update.filename,
            fileExists: update.file_exists
          })
        }
      } catch (e) {
        console.error('Error checking status:', e)
      } finally {
        setIsLoading(false)
      }
    }

    void checkStatus()

    // Poll pairing status every second when plugin is open
    const pollInterval = setInterval(() => {
      void (async () => {
        if (isPairingActionInProgress.current || Date.now() - lastActionTime.current < 2000) {
          return
        }

        try {
          const pairingStatus = await getPairingStatus()
          setPairingAvailable(pairingStatus.available)
          setIsPairing(pairingStatus.pairing)
        } catch (e) {
          console.error('Error polling pairing status:', e)
        }
      })()
    }, 1000)

    return () => clearInterval(pollInterval)
  }, [])

  const handleInstall = async (): Promise<void> => {
    setIsInstalling(true)
    toaster.toast({ title: 'Xone Driver Manager', body: 'Installing drivers...', duration: 5000 })
    try {
      const result = await installDrivers()
      if (result.success) {
        toaster.toast({ title: 'Xone Driver Manager', body: 'Drivers installed!', duration: 5000 })
        setIsInstalled(true)
        const pairingStatus = await getPairingStatus()
        setPairingAvailable(pairingStatus.available)
        setIsPairing(pairingStatus.pairing)
      } else if (result.reboot_required === true) {
        toaster.toast({ title: 'Xone Driver Manager', body: 'Please reboot and reinstall drivers.', duration: 15000 })
      } else {
        toaster.toast({ title: 'Xone Driver Manager', body: (((result.error ?? '') !== '') ? (result.error ?? '') : 'Installation failed'), duration: 8000 })
      }
    } catch (e) {
      toaster.toast({ title: 'Xone Driver Manager', body: String(e), duration: 8000 })
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUninstall = async (): Promise<void> => {
    setIsUninstalling(true)
    toaster.toast({ title: 'Xone Driver Manager', body: 'Removing drivers...', duration: 3000 })
    try {
      const result = await uninstallDrivers()
      if (result.success) {
        toaster.toast({ title: 'Xone Driver Manager', body: 'Drivers removed', duration: 5000 })
        setIsInstalled(false)
        setPairingAvailable(false)
        setIsPairing(false)
      } else {
        toaster.toast({ title: 'Xone Driver Manager', body: (((result.error ?? '') !== '') ? (result.error ?? '') : 'Uninstallation failed'), duration: 8000 })
      }
    } catch (e) {
      toaster.toast({ title: 'Xone Driver Manager', body: String(e), duration: 8000 })
    } finally {
      setIsUninstalling(false)
    }
  }

  const handlePairingToggle = async (enabled: boolean): Promise<void> => {
    setPairingLoading(true)
    isPairingActionInProgress.current = true
    lastActionTime.current = Date.now()
    try {
      const result = enabled ? await enablePairing() : await disablePairing()
      if (result.success) {
        setIsPairing(enabled)
        toaster.toast({
          title: enabled ? 'Pairing Mode Enabled' : 'Pairing Mode Disabled',
          body: enabled ? 'Press pairing button on controller' : 'Pairing mode off',
          duration: 4000
        })
      } else {
        toaster.toast({ title: 'Pairing Error', body: (((result.error ?? '') !== '') ? (result.error ?? '') : 'Failed to change mode'), duration: 5000 })
      }
    } catch (e) {
      toaster.toast({ title: 'Pairing Error', body: String(e), duration: 5000 })
    } finally {
      setPairingLoading(false)
      isPairingActionInProgress.current = false
      lastActionTime.current = Date.now()
    }
  }

  const handleUpdate = async (): Promise<void> => {
    if (updateInfo.url === undefined || updateInfo.url === null) return
    setIsUpdating(true)
    try {
      // 1. Download if file doesn't exist locally
      if (updateInfo.fileExists !== true) {
        toaster.toast({ title: 'Xone Driver Manager', body: 'Downloading update...', duration: 3000 })
        const downloadResult = await downloadLatestRelease(updateInfo.url)
        if (!downloadResult.success) {
          toaster.toast({ title: 'Xone Driver Manager', body: (((downloadResult.error ?? '') !== '') ? (downloadResult.error ?? '') : 'Download failed'), duration: 5000 })
          return
        }
      }

      // 2. Apply update
      const applyResult = await applyUpdate()
      if (applyResult.success) {
        // 3. Refresh sidebar
        setTimeout(() => {
          Navigation.CloseSideMenus()
          setTimeout(() => {
            Navigation.OpenQuickAccessMenu(999)
          }, 500)
        }, 1500)
      } else {
        toaster.toast({ title: 'Xone Manager', body: (((applyResult.error ?? '') !== '') ? (applyResult.error ?? '') : 'Update failed'), duration: 5000 })
      }
    } catch (e) {
      toaster.toast({ title: 'Xone Manager', body: String(e), duration: 5000 })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <PanelSection>
        <PanelSectionRow>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <Spinner />
          </div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  return (
    <PanelSection>
      {/* Driver Status */}
      <PanelSectionRow>
        <div style={{
          padding: '10px',
          backgroundColor: isInstalled ? '#5ba32b' : '#de9c28',
          borderRadius: '8px',
          textAlign: 'center'
        }}
        >
          <span style={{ fontWeight: 'bold', color: '#fff' }}>
            {isInstalled ? 'Drivers Installed' : 'Drivers Not Installed'}
          </span>
        </div>
      </PanelSectionRow>

      {/* Driver Controls */}
      <PanelSectionRow>
        <ButtonItem layout='below' onClick={() => { void handleInstall() }} disabled={isInstalling || isUninstalling}>
          {isInstalling ? 'Installing...' : isInstalled ? 'Reinstall Drivers' : 'Install Drivers'}
        </ButtonItem>
      </PanelSectionRow>

      {isInstalled && (
        <PanelSectionRow>
          <ButtonItem layout='below' onClick={() => { void handleUninstall() }} disabled={isInstalling || isUninstalling}>
            {isUninstalling ? 'Uninstalling...' : 'Uninstall Drivers'}
          </ButtonItem>
        </PanelSectionRow>
      )}

      {/* Pairing Toggle */}
      <PanelSectionRow>
        <ToggleField
          label='Dongle Pairing Mode'
          description={!pairingAvailable ? 'Dongle not detected' : isPairing ? 'Waiting...' : 'Enable to pair'}
          checked={isPairing}
          disabled={pairingLoading || !pairingAvailable}
          onChange={(checked) => { void handlePairingToggle(checked) }}
        />
      </PanelSectionRow>

      {/* Update Banner */}
      {updateInfo.available && (
        <PanelSectionRow>
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(92, 163, 43, 0.15)',
            border: '1px solid #5ba32b',
            borderRadius: '8px',
            marginTop: '8px'
          }}
          >
            <div style={{ fontWeight: 'bold', color: '#5ba32b', marginBottom: '8px' }}>
              Update Available (v{updateInfo.version ?? ''})
            </div>
            <ButtonItem layout='below' onClick={() => { void handleUpdate() }} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Download & Install Update'}
            </ButtonItem>
          </div>
        </PanelSectionRow>
      )}

      {/* Version footer */}
      <PanelSectionRow>
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#888', padding: '10px 0', opacity: 0.6 }}>
          v{version}
        </div>
      </PanelSectionRow>
    </PanelSection>
  )
}

export default definePlugin(() => {
  const kernelUpdateListener = addEventListener<[string, string]>(
    'kernel_update_detected',
    () => toaster.toast({ title: 'Xone Driver Manager', body: 'Drivers need reinstalling after OS update', duration: 10000 })
  )

  return {
    name: 'Xone Driver Manager',
    titleView: <div className={staticClasses.Title}>Xone Driver Manager</div>,
    content: <Content />,
    icon: <FaGamepad />,
    onDismount () {
      removeEventListener('kernel_update_detected', kernelUpdateListener)
    }
  }
})
