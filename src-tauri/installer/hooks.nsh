; Keep the legacy Central Hub installation when adopting the fixed CentralHub name.
; Only the exact current-user installation owned by this project is eligible.
!define MUI_CUSTOMFUNCTION_GUIINIT CentralHubLegacyInit
Var CentralHubLegacyPath
Var CentralHubLegacyFound

Function CentralHubLegacyInit
  Push $0
  Push $1
  Push $2
  Push $3
  StrCpy $CentralHubLegacyFound 0
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CentralHub" "UninstallString"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Central Hub" "DisplayName"
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Central Hub" "Publisher"
    ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Central Hub" "MainBinaryName"
    ReadRegStr $3 HKCU "Software\centralhub\Central Hub" ""
    ${If} $0 == "Central Hub"
    ${AndIf} $1 == "centralhub"
    ${AndIf} $2 == "central-hub.exe"
    ${AndIf} $3 != ""
      IfFileExists "$3\central-hub.exe" 0 centralhub_legacy_done
      IfFileExists "$3\uninstall.exe" 0 centralhub_legacy_done
      StrCpy $CentralHubLegacyPath $3
      StrCpy $CentralHubLegacyFound 1
      ; Honor a user-selected location or an explicit /D argument.
      ${If} $INSTDIR == "$LOCALAPPDATA\CentralHub"
        StrCpy $INSTDIR $CentralHubLegacyPath
      ${EndIf}
    ${EndIf}
  ${EndIf}
  centralhub_legacy_done:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  ; .onGUIInit does not run in silent mode. Revalidate here in both modes.
  Call CentralHubLegacyInit
  ${If} $CentralHubLegacyFound == 1
  ${AndIf} $INSTDIR == $CentralHubLegacyPath
    !insertmacro CheckIfAppIsRunning "$INSTDIR\central-hub.exe" "CentralHub"
  ${EndIf}
  SetOutPath $INSTDIR
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Remove legacy entries only after the replacement binary and uninstaller exist.
  ${If} $CentralHubLegacyFound == 1
  ${AndIf} $INSTDIR == $CentralHubLegacyPath
    IfFileExists "$INSTDIR\CentralHub.exe" 0 centralhub_legacy_cleanup_done
    IfFileExists "$INSTDIR\uninstall.exe" 0 centralhub_legacy_cleanup_done
    !insertmacro IsShortcutTarget "$SMPROGRAMS\Central Hub.lnk" "$INSTDIR\central-hub.exe"
    Pop $0
    ${If} $0 == 1
      Delete "$SMPROGRAMS\Central Hub.lnk"
    ${EndIf}
    !insertmacro IsShortcutTarget "$DESKTOP\Central Hub.lnk" "$INSTDIR\central-hub.exe"
    Pop $0
    ${If} $0 == 1
      Delete "$DESKTOP\Central Hub.lnk"
      ${If} $NoShortcutMode != 1
        Call CreateOrUpdateDesktopShortcut
      ${EndIf}
    ${EndIf}
    Delete "$INSTDIR\central-hub.exe"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Central Hub"
    DeleteRegKey HKCU "Software\centralhub\Central Hub"
  ${EndIf}
  centralhub_legacy_cleanup_done:
!macroend
