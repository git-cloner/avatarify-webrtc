import { faBolt, faDesktop, faPerson, faStop } from '@fortawesome/free-solid-svg-icons';
import { Room } from 'livekit-client';
import React, { ReactElement } from 'react';
import { useParticipant } from '@livekit/react-core';
import { AudioSelectButton } from './AudioSelectButton';
import { ControlButton } from './ControlButton';
import styles from './styles.module.css';
import { VideoSelectButton } from './VideoSelectButton';
import Stack from '@mui/material/Stack';
import { useNavigate } from 'react-router-dom';

export interface ControlsProps {
  room: Room;
  enableScreenShare?: boolean;
  enableAudio?: boolean;
  enableVideo?: boolean;
  avatarStatus?:string;
  onLeave?: (room: Room) => void;
  onAvatar?: (room: Room) => void;
}

export const ControlsView = ({
  room,
  enableScreenShare,
  enableAudio,
  enableVideo,
  avatarStatus,
  onLeave,
  onAvatar,
}: ControlsProps) => {
  const { cameraPublication: camPub, microphonePublication: micPub } = useParticipant(
    room.localParticipant,
  );

  const navigate = useNavigate();

  if (enableScreenShare === undefined) {
    enableScreenShare = true;
  }
  if (enableVideo === undefined) {
    enableVideo = true;
  }
  if (enableAudio === undefined) {
    enableAudio = true;
  }

  const [audioButtonDisabled, setAudioButtonDisabled] = React.useState(false);
  let muteButton: ReactElement | undefined;
  if (enableAudio) {
    const enabled = !(micPub?.isMuted ?? true);
    muteButton = (
      <AudioSelectButton
        isMuted={!enabled}
        isButtonDisabled={audioButtonDisabled}
        onClick={async () => {
          setAudioButtonDisabled(true);
          room.localParticipant
            .setMicrophoneEnabled(!enabled)
            .finally(() => setAudioButtonDisabled(false));
        }}
        onSourceSelected={(device) => {
          setAudioButtonDisabled(true);
          room
            .switchActiveDevice('audioinput', device.deviceId)
            .finally(() => setAudioButtonDisabled(false));
        }}
      />
    );
  }

  const [videoButtonDisabled, setVideoButtonDisabled] = React.useState(false);

  let videoButton: ReactElement | undefined;
  if (enableVideo) {
    const enabled = !(camPub?.isMuted ?? true);
    videoButton = (
      <VideoSelectButton
        isEnabled={enabled}
        isButtonDisabled={videoButtonDisabled}
        onClick={() => {
          setVideoButtonDisabled(true);
          room.localParticipant
            .setCameraEnabled(!enabled)
            .finally(() => setVideoButtonDisabled(false));
        }}
        onSourceSelected={(device) => {
          setVideoButtonDisabled(true);
          room
            .switchActiveDevice('videoinput', device.deviceId)
            .finally(() => setVideoButtonDisabled(false));
        }}
      />
    );
  }

  const [screenButtonDisabled, setScreenButtonDisabled] = React.useState(false);
  let screenButton: ReactElement | undefined;
  if (enableScreenShare) {
    const enabled = room.localParticipant.isScreenShareEnabled;
    screenButton = (
      <ControlButton
        label={enabled ? 'Stop sharing' : 'Share screen'}
        icon={enabled ? faStop : faDesktop}
        disabled={screenButtonDisabled}
        onClick={() => {
          setScreenButtonDisabled(true);
          room.localParticipant
            .setScreenShareEnabled(!enabled)
            .finally(() => setScreenButtonDisabled(false));
        }}
      />
    );
  }

  const onReconnect = () => {
    navigate('/');
    setTimeout(() => {
      const params: { [key: string]: string } = {
        videoEnabled: enableVideo ? '1' : '0',
        audioEnabled: enableAudio ? '1' : '0',
        simulcast: '1',
        dynacast: '1',
        adaptiveStream: '1',
      };
      navigate({
        pathname: '/room',
        search: '?' + new URLSearchParams(params).toString(),
      });
    }, 1000);
  };

  let reconnectButton: ReactElement | undefined;
  reconnectButton = (
    <ControlButton label='reconnect' icon={faBolt} onClick={onReconnect}></ControlButton>
  );

  let avatarButton: ReactElement | undefined;
  avatarButton = (
    <ControlButton label={avatarStatus ? avatarStatus:'avatar'} className={styles.avatarButton} icon={faPerson} onClick={() => {
      onAvatar!(room);
    }}></ControlButton>
  );

  return (
    <div className={styles.controlsWrapper}>
      <Stack spacing={1} direction="row" justifyContent="center">
        {muteButton}
        {videoButton}
        {screenButton}
        {reconnectButton}
        {avatarButton}
        {onLeave && (
          <ControlButton
            label="Disconnect"
            className={styles.dangerButton}
            onClick={() => {
              room.disconnect();
              onLeave(room);
            }}
          />
        )}
      </Stack>
    </div>
  );
};
