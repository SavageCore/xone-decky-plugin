import React, { useState, useEffect, useRef } from 'react'
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  ToggleField,
  staticClasses,
  Spinner
} from '@decky/ui'
import { addEventListener, removeEventListener, callable, definePlugin, toaster } from '@decky/api'
import { FaGamepad } from 'react-icons/fa'

// Backend callable functions
const getInstallStatus = callable<
[],
{
  xone_installed: boolean
  xpad_installed: boolean
  fully_installed: boolean
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

function Content (): React.ReactElement {
  const [isInstalled, setIsInstalled] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isInstalling, setIsInstalling] = useState<boolean>(false)
  const [isUninstalling, setIsUninstalling] = useState<boolean>(false)
  const [pairingAvailable, setPairingAvailable] = useState<boolean>(false)
  const [isPairing, setIsPairing] = useState<boolean>(false)
  const [pairingLoading, setPairingLoading] = useState<boolean>(false)
  const isPairingActionInProgress = useRef<boolean>(false)
  const lastActionTime = useRef<number>(0)

  // Check status on mount
  useEffect(() => {
    const checkStatus = async (): Promise<void> => {
      try {
        const installStatus = await getInstallStatus()
        setIsInstalled(installStatus.fully_installed)

        const pairingStatus = await getPairingStatus()
        setPairingAvailable(pairingStatus.available)
        setIsPairing(pairingStatus.pairing)
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
        // Don't update from poll if we are currently performing an action
        // or if we just performed one (2 second cooldown)
        if (isPairingActionInProgress.current || Date.now() - lastActionTime.current < 2000) {
          return
        }

        try {
          const pairingStatus = await getPairingStatus()
          console.debug('Pairing status poll result:', pairingStatus)
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
    toaster.toast({
      title: 'Installing Drivers',
      body: 'This may take several minutes. Please wait...',
      duration: 5000
    })

    try {
      const result = await installDrivers()

      if (result.success) {
        toaster.toast({
          title: 'Installation Complete',
          body: 'Drivers installed successfully!',
          duration: 5000
        })
        setIsInstalled(true)

        // Check pairing availability after install
        const pairingStatus = await getPairingStatus()
        setPairingAvailable(pairingStatus.available)
        setIsPairing(pairingStatus.pairing)
      } else if (result.reboot_required === true) {
        // Kernel was upgraded, reboot needed
        toaster.toast({
          title: 'Reboot Required',
          body: 'Kernel mismatch detected. Please reboot and reinstall drivers.',
          duration: 15000
        })
      } else {
        toaster.toast({
          title: 'Installation Failed',
          body: (result.error !== undefined && result.error !== '') ? result.error : 'An error occurred during installation',
          duration: 8000
        })
      }
    } catch (e) {
      console.error('Install error:', e)
      toaster.toast({
        title: 'Installation Error',
        body: String(e),
        duration: 8000
      })
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUninstall = async (): Promise<void> => {
    setIsUninstalling(true)
    toaster.toast({
      title: 'Uninstalling Drivers',
      body: 'Removing drivers...',
      duration: 3000
    })

    try {
      const result = await uninstallDrivers()

      if (result.success) {
        toaster.toast({
          title: 'Uninstall Complete',
          body: 'Drivers removed',
          duration: 5000
        })
        setIsInstalled(false)
        setPairingAvailable(false)
        setIsPairing(false)
      } else {
        toaster.toast({
          title: 'Uninstall Failed',
          body: (result.error !== undefined && result.error !== '') ? result.error : 'An error occurred during uninstallation',
          duration: 8000
        })
      }
    } catch (e) {
      console.error('Uninstall error:', e)
      toaster.toast({
        title: 'Uninstall Error',
        body: String(e),
        duration: 8000
      })
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
          body: enabled
            ? 'Press the pairing button on your controller to connect'
            : 'Pairing mode turned off',
          duration: 4000
        })
      } else {
        toaster.toast({
          title: 'Pairing Error',
          body: (result.error !== undefined && result.error !== '') ? result.error : 'Failed to change pairing mode',
          duration: 5000
        })
      }
    } catch (e) {
      console.error('Pairing toggle error:', e)
      toaster.toast({
        title: 'Pairing Error',
        body: String(e),
        duration: 5000
      })
    } finally {
      setPairingLoading(false)
      isPairingActionInProgress.current = false
      lastActionTime.current = Date.now() // Update again after action finishes
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
      {/* Status Display */}
      <PanelSectionRow>
        <div
          style={{
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

      {/* Install/Reinstall Button */}
      <PanelSectionRow>
        <ButtonItem
          layout='below'
          onClick={() => { void handleInstall() }}
          disabled={isInstalling || isUninstalling}
        >
          {isInstalling
            ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Spinner style={{ width: '16px', height: '16px' }} />
                Installing...
              </span>
              )
            : isInstalled
              ? (
                  'Reinstall Drivers'
                )
              : (
                  'Install Drivers'
                )}
        </ButtonItem>
      </PanelSectionRow>

      {/* Uninstall Button - only show if installed */}
      {isInstalled && (
        <PanelSectionRow>
          <ButtonItem
            layout='below'
            onClick={() => { void handleUninstall() }}
            disabled={isInstalling || isUninstalling}
          >
            {isUninstalling
              ? (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Spinner style={{ width: '16px', height: '16px' }} />
                  Uninstalling...
                </span>
                )
              : (
                  'Uninstall Drivers'
                )}
          </ButtonItem>
        </PanelSectionRow>
      )}

      {/* Pairing Toggle - only show if dongle available */}
      {pairingAvailable && (
        <PanelSectionRow>
          <ToggleField
            label='Dongle Pairing Mode'
            description={
              isPairing ? 'Waiting for controller...' : 'Enable to pair a new controller'
            }
            checked={isPairing}
            disabled={pairingLoading}
            onChange={(enabled) => { void handlePairingToggle(enabled) }}
          />
        </PanelSectionRow>
      )}

      {/* Help text when not installed */}
      {!isInstalled && (
        <PanelSectionRow>
          <div
            style={{
              padding: '10px',
              fontSize: '12px',
              color: '#aaa',
              lineHeight: '1.4'
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              Driver management for Xbox One & Series controllers. Supports wired and wireless (via
              optional Xbox Wireless Adaptor for Windows)
            </div>
            <div>
              <b>xone</b>: Modern replacement for xpad
            </div>
            <div style={{ marginTop: '4px' }}>
              <b>xpad-noone</b>: Legacy support for 360 peripherals (GP2040-CE! ❤️)
            </div>
          </div>
        </PanelSectionRow>
      )}
    </PanelSection>
  )
}

export default definePlugin(() => {
  console.log('Xone Driver Manager plugin loaded')

  // Listen for kernel update detection from backend
  const kernelUpdateListener = addEventListener<[oldKernel: string, newKernel: string]>(
    'kernel_update_detected',
    (oldKernel, newKernel) => {
      console.log(`Kernel update detected: ${oldKernel} -> ${newKernel}`)
      toaster.toast({
        title: 'Xone Driver Manager',
        body: 'SteamOS updated, drivers need reinstalling',
        duration: 10000
      })
    }
  )

  return {
    name: 'Xone Driver Manager',
    titleView: <div className={staticClasses.Title}>Xone Driver Manager</div>,
    content: <Content />,
    icon: <FaGamepad />,
    onDismount () {
      console.log('Xone Driver Manager plugin unloaded')
      removeEventListener('kernel_update_detected', kernelUpdateListener)
    }
  }
})
