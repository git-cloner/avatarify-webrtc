import { faBolt, faDesktop, faPerson, faStop } from '@fortawesome/free-solid-svg-icons';
import { Room } from 'livekit-client';
import React, { ReactElement, useState } from 'react';
import { useParticipant } from '@livekit/react-core';
import { AudioSelectButton } from './AudioSelectButton';
import { ControlButton } from './ControlButton';
import styles from './styles.module.css';
import { VideoSelectButton } from './VideoSelectButton';
import Stack from '@mui/material/Stack';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box/Box';
import Typography from '@mui/material/Typography/Typography';
import CircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress/CircularProgress';

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
  const [avatarProgress, setAvatarProgress] = useState(0);

  if (enableScreenShare === undefined) {
    enableScreenShare = true;
  }
  if (enableVideo === undefined) {
    enableVideo = true;
  }
  if (enableAudio === undefined) {
    enableAudio = true;
  }

  const refreshProgress = () => {
    var progress = 0 ;
    const timer = setInterval(() => {
      if (progress >= 100) {
        setAvatarProgress(0);
        clearInterval(timer)
      } else {
        progress = progress + 1 ;
        setAvatarProgress(progress);
      }
    }, 300);
  } ;

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
      refreshProgress() ; 
      onAvatar!(room);
    }}></ControlButton>
  );

  const AvatarProgressBar = () => {
    if (avatarProgress > 0) {
      return <div>
        <CircularProgressWithLabel></CircularProgressWithLabel>
      </div>;
    }
    else {
      return <div></div>;
    }
  }

  const CircularProgressWithLabel = (
    props: CircularProgressProps
  ) => {
    return (
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" {...props} />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
          >{`${Math.round(avatarProgress)}%`}</Typography>
        </Box>
      </Box>
    );
  }

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
        <AvatarProgressBar />
      </Stack>
    </div>
  );
};
