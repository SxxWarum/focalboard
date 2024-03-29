// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Card} from '../../blocks/card'
import ButtonWithMenu from '../../widgets/buttons/buttonWithMenu'
import CardIcon from '../../widgets/icons/card'
import AddIcon from '../../widgets/icons/add'
import Menu from '../../widgets/menu'
import {useAppSelector} from '../../store/hooks'
import {getCurrentBoardTemplates} from '../../store/cards'

import NewCardButtonTemplateItem from './newCardButtonTemplateItem'

type Props = {
    addCard: () => void
    addCardFromTemplate: (cardTemplateId: string) => void
    addCardTemplate: () => void
    editCardTemplate: (cardTemplateId: string) => void
}

const NewCardButton = React.memo((props: Props): JSX.Element => {
    const cardTemplates: Card[] = useAppSelector(getCurrentBoardTemplates)
    const intl = useIntl()

    return (
        <ButtonWithMenu
            onClick={() => {
                props.addCard()
            }}
            text={(
                <FormattedMessage
                    id='ViewHeader.new'
                    defaultMessage='New'
                />
            )}
        >
            <Menu position='left'>
                {cardTemplates.length > 0 && <>
                    <Menu.Label>
                        <b>
                            <FormattedMessage
                                id='ViewHeader.select-a-template'
                                defaultMessage='Select a template'
                            />
                        </b>
                    </Menu.Label>

                    <Menu.Separator/>
                </>}

                {cardTemplates.map((cardTemplate) => (
                    <NewCardButtonTemplateItem
                        key={cardTemplate.id}
                        cardTemplate={cardTemplate}
                        addCardFromTemplate={props.addCardFromTemplate}
                        editCardTemplate={props.editCardTemplate}
                    />
                ))}

                <Menu.Text
                    icon={<CardIcon/>}
                    id='empty-template'
                    name={intl.formatMessage({id: 'ViewHeader.empty-card', defaultMessage: 'Empty card'})}
                    onClick={() => {
                        props.addCard()
                    }}
                />

                <Menu.Text
                    icon={<AddIcon/>}
                    id='add-template'
                    name={intl.formatMessage({id: 'ViewHeader.add-template', defaultMessage: 'New template'})}
                    onClick={() => props.addCardTemplate()}
                />
            </Menu>
        </ButtonWithMenu>
    )
})

export default NewCardButton
