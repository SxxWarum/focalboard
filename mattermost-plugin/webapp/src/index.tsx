// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'
import {Store, Action} from 'redux'
import {Provider as ReduxProvider} from 'react-redux'
import {useHistory} from 'mm-react-router-dom'

import {GlobalState} from 'mattermost-redux/types/store'
import {getTheme} from 'mattermost-redux/selectors/entities/preferences'

const windowAny = (window as any)
windowAny.baseURL = '/plugins/focalboard'
windowAny.frontendBaseURL = '/boards'
windowAny.isFocalboardPlugin = true

import App from '../../../webapp/src/app'
import store from '../../../webapp/src/store'
import GlobalHeader from '../../../webapp/src/components/globalHeader/globalHeader'
import FocalboardIcon from '../../../webapp/src/widgets/icons/logo'
import {setMattermostTheme} from '../../../webapp/src/theme'
import wsClient, {MMWebSocketClient, ACTION_UPDATE_BLOCK} from './../../../webapp/src/wsclient'

import '../../../webapp/src/styles/focalboard-variables.scss'
import '../../../webapp/src/styles/main.scss'
import '../../../webapp/src/styles/labels.scss'

import manifest from './manifest'
import ErrorBoundary from './error_boundary'

// eslint-disable-next-line import/no-unresolved
import {PluginRegistry} from './types/mattermost-webapp'

import './plugin.scss'

type Props = {
    webSocketClient: MMWebSocketClient
}

const MainApp = (props: Props) => {
    const [faviconStored, setFaviconStored] = useState(false)
    wsClient.initPlugin(manifest.id, props.webSocketClient)

    useEffect(() => {
        document.body.classList.add('focalboard-body')
        const root = document.getElementById('root')
        if (root) {
            root.classList.add('focalboard-plugin-root')
        }

        return () => {
            document.body.classList.remove('focalboard-body')
            if (root) {
                root.classList.remove('focalboard-plugin-root')
            }
        }
    }, [])

    useEffect(() => {
        const oldLinks = document.querySelectorAll("link[rel*='icon']") as NodeListOf<HTMLLinkElement>
        if (!oldLinks) {
            return () => null
        }
        setFaviconStored(true)

        return () => {
            document.querySelectorAll("link[rel*='icon']").forEach((n) => n.remove())
            oldLinks.forEach((link) => document.getElementsByTagName('head')[0].appendChild(link))
        }
    }, [])

    return (
        <ErrorBoundary>
            <ReduxProvider store={store}>
                <div id='focalboard-app'>
                    {faviconStored && <App/>}
                </div>
                <div id='focalboard-root-portal'/>
            </ReduxProvider>
        </ErrorBoundary>
    )
}

const HeaderComponent = () => {
    return (
        <ErrorBoundary>
            <GlobalHeader/>
        </ErrorBoundary>
    )
}

export default class Plugin {
    channelHeaderButtonId?: string
    registry?: PluginRegistry

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    async initialize(registry: PluginRegistry, mmStore: Store<GlobalState, Action<Record<string, unknown>>>): Promise<void> {
        this.registry = registry

        let theme = getTheme(mmStore.getState())
        setMattermostTheme(theme)
        let lastViewedChannel = mmStore.getState().entities.channels.currentChannelId
        mmStore.subscribe(() => {
            const currentTheme = getTheme(mmStore.getState())
            if (currentTheme !== theme && currentTheme) {
                setMattermostTheme(currentTheme)
                theme = currentTheme
            }

            const currentUserId = mmStore.getState().entities.users.currentUserId
            const currentChannel = mmStore.getState().entities.channels.currentChannelId
            if (lastViewedChannel !== currentChannel && currentChannel) {
                localStorage.setItem('focalboardLastViewedChannel:' + currentUserId, currentChannel)
                lastViewedChannel = currentChannel
            }
        })

        if (this.registry.registerProduct) {
            windowAny.frontendBaseURL = '/boards'
            const goToFocalboardWorkspace = () => {
                const currentChannel = mmStore.getState().entities.channels.currentChannelId
                window.open(`${window.location.origin}/boards/workspace/${currentChannel}`)
            }
            this.channelHeaderButtonId = registry.registerChannelHeaderButtonAction(<FocalboardIcon/>, goToFocalboardWorkspace, '', 'Boards')

            this.registry.registerCustomRoute('go-to-current-workspace', () => {
                const history = useHistory()
                useEffect(() => {
                    const currentChannel = mmStore.getState().entities.channels.currentChannelId
                    if (currentChannel) {
                        history.replace(`/boards/workspace/${currentChannel}`)
                        return
                    }
                    const currentUserId = mmStore.getState().entities.users.currentUserId
                    const lastChannelId = localStorage.getItem('focalboardLastViewedChannel:' + currentUserId)
                    if (lastChannelId) {
                        history.replace(`/boards/workspace/${lastChannelId}`)
                        return
                    }
                    history.goBack()
                }, [])
                return <></>
            })
            this.registry.registerProduct('/boards', 'product-boards', 'Boards', '/plug/focalboard/go-to-current-workspace', MainApp, HeaderComponent)
        } else {
            windowAny.frontendBaseURL = '/plug/focalboard'
            this.channelHeaderButtonId = registry.registerChannelHeaderButtonAction(<FocalboardIcon/>, () => {
                const currentChannel = mmStore.getState().entities.channels.currentChannelId
                window.open(`${window.location.origin}/plug/focalboard/workspace/${currentChannel}`)
            }, '', 'Boards')
            this.registry.registerCustomRoute('/', MainApp)
        }

        // register websocket handlers
        this.registry?.registerWebSocketEventHandler(`custom_${manifest.id}_${ACTION_UPDATE_BLOCK}`, (e: any) => wsClient.updateBlockHandler(e.data))
    }

    uninitialize(): void {
        if (this.channelHeaderButtonId) {
            this.registry?.unregisterComponent(this.channelHeaderButtonId)
        }

        // unregister websocket handlers
        this.registry?.unregisterWebSocketEventHandler(wsClient.clientPrefix + ACTION_UPDATE_BLOCK)
    }
}

declare global {
    interface Window {
        registerPlugin(id: string, plugin: Plugin): void
    }
}

window.registerPlugin(manifest.id, new Plugin())
