import { faSquare, faThLarge, faUserFriends } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Room, RoomEvent, setLogLevel, VideoPresets } from 'livekit-client';
import { DisplayContext, DisplayOptions, LiveKitRoom, ParticipantProps, StageProps } from '@livekit/react-components';
import { useRef, useState } from 'react';
import 'react-aspect-ratio/aspect-ratio.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { ParticipantView } from './meeting/ParticipantView';
import { StageView } from './meeting/StageView';
import { ControlsProps, ControlsView } from './meeting/ControlsView';
import SelectAvatarDialog from './SelectAvatar';
import { WebrtcCli } from './webrtc/WebrtcCli';
import Box from '@mui/material/Box/Box';
import Typography from '@mui/material/Typography/Typography';
import CircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress/CircularProgress';

export const RoomPage = () => {
  const [numParticipants, setNumParticipants] = useState(0);
  const [selectedValue, setSelectedValue] = useState("0");
  const [open, setOpen] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    stageLayout: 'grid',
    showStats: false,
  });
  const navigate = useNavigate();
  const query = new URLSearchParams(useLocation().search);
  const url = query.get('url');
  const token = query.get('token');
  const recorder = query.get('recorder');
  const [roomname, setRoomname] = useState<string>('');
  const [userid, setUserid] = useState<string>('');
  const videoRefLocal = useRef<any>();
  const videoRefRemote = useRef<any>();
  const [webrtccli, setWebrtccli] = useState<any>();
  const [avatarStatus, setAvatarStatus] = useState("Avatar");
  const [avatarProgress, setAvatarProgress] = useState(0);

  if (!url || !token) {
    return <div>url and token are required</div>;
  }

  const onLeave = () => {
    navigate('/');
  };

  const onAvatar = () => {
    if (avatarStatus === "Avatar") {
      handleClickOpen();
    } else {
      webrtccli.stopRecording();
      setAvatarStatus("Avatar");
    }
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

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

  const handleClose = (value: string) => {
    if (avatarStatus === "Avatar") {
      setOpen(false);
      setSelectedValue(value);
      if (value === "0") {
        return;
      }
      setAvatarStatus("Stop avatar");
      let _webrtccli = new WebrtcCli({
        source: videoRefLocal.current,
        destination: videoRefRemote.current,
        debug: false,
        audio: false,
        video: true,
        avator: value + '|1|' + roomname + '|' + userid
      });
      setWebrtccli(_webrtccli);
      _webrtccli.startRecording();
      refreshProgress() ;      
    };
  };

  const updateParticipantSize = (room: Room) => {
    setNumParticipants(room.participants.size + 1);
    setUserid(room.localParticipant.name ? room.localParticipant.name : "");
    setRoomname(room.name);
  };

  const onParticipantDisconnected = (room: Room) => {
    updateParticipantSize(room);

    /* Special rule for recorder */
    if (recorder && parseInt(recorder, 10) === 1 && room.participants.size === 0) {
      console.log('END_RECORDING');
    }
  };

  const updateOptions = (options: DisplayOptions) => {
    setDisplayOptions({
      ...displayOptions,
      ...options,
    });
  };

  const participantRenderer = (props: ParticipantProps) => {
    return ParticipantView(props);
  };

  const stageRenderer = (props: StageProps) => {
    return StageView(props);
  }

  const controlRenderer = (props: ControlsProps) => {
    return <ControlsView room={props.room} onAvatar={onAvatar} onLeave={onLeave} avatarStatus={avatarStatus} />
  }

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
    <DisplayContext.Provider value={displayOptions}>
      <div className="roomContainer">
        <div className="topBar">
          <label className='label'>room：{roomname}</label>
          <div className="right">
            <AvatarProgressBar />
            <div>
              <input
                id="showStats"
                type="checkbox"
                onChange={(e) => updateOptions({ showStats: e.target.checked })}
              />
              <label htmlFor="showStats">Show Stats</label>
            </div>
            <div>
              <button
                className="iconButton"
                disabled={displayOptions.stageLayout === 'grid'}
                onClick={() => {
                  updateOptions({ stageLayout: 'grid' });
                }}
              >
                <FontAwesomeIcon height={32} icon={faThLarge} />
              </button>
              <button
                className="iconButton"
                disabled={displayOptions.stageLayout === 'speaker'}
                onClick={() => {
                  updateOptions({ stageLayout: 'speaker' });
                }}
              >
                <FontAwesomeIcon height={32} icon={faSquare} />
              </button>
            </div>
            <div className="participantCount">
              <FontAwesomeIcon icon={faUserFriends} />
              <span>{numParticipants}</span>
            </div>
          </div>
        </div>
        <LiveKitRoom
          url={url}
          token={token}
          onConnected={(room) => {
            setLogLevel('info');
            onConnected(room, query);
            room.on(RoomEvent.ParticipantConnected, () => updateParticipantSize(room));
            room.on(RoomEvent.ParticipantDisconnected, () => onParticipantDisconnected(room));
            updateParticipantSize(room);
          }}
          roomOptions={{
            adaptiveStream: isSet(query, 'adaptiveStream'),
            dynacast: isSet(query, 'dynacast'),
            videoCaptureDefaults: {
              resolution: VideoPresets.h720.resolution,
            },
          }}
          participantRenderer={(props: ParticipantProps) => {
            return participantRenderer(props);
          }}
          stageRenderer={(props: StageProps) => {
            return stageRenderer(props);
          }}

          controlRenderer={(props: ControlsProps) => {
            //props.onAvatar = on
            return controlRenderer(props);
          }}
          onLeave={onLeave}
        />
        <div>
          <SelectAvatarDialog
            selectedValue={selectedValue}
            open={open}
            onClose={handleClose} />
          <video id="video_local" autoPlay playsInline ref={videoRefLocal} height="350" width="350"></video>
          <video id="video_remote" autoPlay ref={videoRefRemote} height="350" width="350"></video>
        </div>
      </div>
    </DisplayContext.Provider>
  );

};

async function onConnected(room: Room, query: URLSearchParams) {
  // make it easier to debug
  (window as any).currentRoom = room;

  if (isSet(query, 'audioEnabled')) {
    const audioDeviceId = query.get('audioDeviceId');
    if (audioDeviceId && room.options.audioCaptureDefaults) {
      room.options.audioCaptureDefaults.deviceId = audioDeviceId;
    }
    await room.localParticipant.setMicrophoneEnabled(true);
  }

  if (isSet(query, 'videoEnabled')) {
    const videoDeviceId = query.get('videoDeviceId');
    if (videoDeviceId && room.options.videoCaptureDefaults) {
      room.options.videoCaptureDefaults.deviceId = videoDeviceId;
    }
    await room.localParticipant.setCameraEnabled(true);
  }
}

function isSet(query: URLSearchParams, key: string): boolean {
  return query.get(key) === '1' || query.get(key) === 'true';
}
