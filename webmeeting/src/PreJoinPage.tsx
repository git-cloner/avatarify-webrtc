import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactCodeInput from 'react-code-input';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from "@mui/icons-material/MicOff";
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Input from '@mui/material/Input';
import AccountCircle from '@mui/icons-material/AccountCircle';
import InputAdornment from '@mui/material/InputAdornment';
import FaceIcon from '@mui/icons-material/Face';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';
import { authtoken } from './config';
import SelectAvatarDialog from './SelectAvatar';
import { WebrtcCli } from './webrtc/WebrtcCli';

export const PreJoinPage = () => {
  const [username, setUsername] = useState<string>('');
  const [roomnum, setRoomnum] = useState<string>('');
  const [roomnum1, setRoomnum1] = useState<string>('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [adaptiveStream] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [connectDisabled, setConnectDisabled] = useState(true);
  const navigate = useNavigate();
  const [mutebuttonText, setMutebuttonText] = useState<string>('Mute');
  const [vediobuttonText, setVediobuttonText] = useState<string>('Disable Vedio');
  const usernameRef = useRef();
  const videoRefLocal = useRef<any>();
  const videoRefRemote = useRef<any>();
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState("0");
  const [avatarStatus, setAvatarStatus] = useState("Test avatar");
  const [webrtccli, setWebrtccli] = useState<any>();

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = (value: string) => {
    if (avatarStatus === "Test avatar") {
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
        avator: value
      });
      setWebrtccli(_webrtccli);
      _webrtccli.startRecording();
    } ;
  };

  useEffect(() => {
    var _roomnum = roomnum;
    if (roomnum1) {
      if (!(roomnum1 === "")) {
        _roomnum = roomnum1;
      }
    }
    if (username && _roomnum) {
      setConnectDisabled(false);
    } else {
      setConnectDisabled(true);
    }

  }, [username, roomnum, roomnum1]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handleChange1 = (value: string) => {
    setRoomnum1(value);
  };

  const toggleAudio = () => {
    if (audioEnabled) {
      setAudioEnabled(false);
      setMutebuttonText("UnMute");
    } else {
      setAudioEnabled(true);
      setMutebuttonText("Mute");
    }
  };

  const toggleVedio = () => {
    if (videoEnabled) {
      setVideoEnabled(false);
      setVediobuttonText("EnableVedio");
    } else {
      setVideoEnabled(true);
      setVediobuttonText("Disable Vedio");
    }
  };

  const toggleNewRoom = async () => {
    try {
      const response = await fetch('/api/aiit/meeting', {
        method: 'POST',
        body: JSON.stringify({
          params: 'create-room'
        }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Authorization': 'Basic ' + authtoken
        },
      });
      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`);
      }
      const rnt = (await response.json());
      if (rnt.code === "0") {
        setRoomnum(rnt.result.roomnum);
        setRoomnum1("");
        (usernameRef?.current as any).querySelector("input").focus();
      }
      else {
        throw new Error(`Error! status: ${rnt.message}`);
      }
    } catch (error) {
      throw new Error(`Error! status: ${error}`);
    }
  }

  const createToken = async () => {
    try {
      var _roomnum = roomnum;
      if (roomnum1) {
        if (!(roomnum1 === "")) {
          _roomnum = roomnum1;
        }
      }
      const response = await fetch('/api/aiit/meeting', {
        method: 'POST',
        body: JSON.stringify({
          params: 'create-token --room ' + _roomnum + ' --join -i ' + username + ' -p 0000'
        }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Authorization': 'Basic ' + authtoken
        },
      });
      if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`);
      }
      const rnt = (await response.json());
      if (rnt.code === "0") {
        return rnt.result.token;
      }
      else {
        throw new Error(`Error! status: ${rnt.message}`);
      }
    } catch (error) {
      throw new Error(`Error! status: ${error}`);
    }
  };

  const connectToRoom = async () => {
    var url = "wss://classnotfound.com.cn/wss";
    createToken().then((token: any) => {
      const params: { [key: string]: string } = {
        url,
        token,
        videoEnabled: videoEnabled ? '1' : '0',
        audioEnabled: audioEnabled ? '1' : '0',
        simulcast: '1',
        dynacast: '1',
        adaptiveStream: adaptiveStream ? '1' : '0',
      };
      navigate({
        pathname: '/room',
        search: '?' + new URLSearchParams(params).toString(),
      });
    }).catch((e) => {
      alert(e);
    });

  };

  async function toggleAvatar() {
    if (avatarStatus === "Test avatar") {
      handleClickOpen();
    }else{
      webrtccli.stopRecording();
      setAvatarStatus("Test avatar");
    }    
  }

  return (
    <div className="prejoin">
      <main>
        <h2>Aiit meeting with avatar</h2>
        <div className="entrySection">
          <div>
            <div className="label">Room Number</div>
            <div>
              <ReactCodeInput fields={6} name="roomnum" inputMode="numeric" value={roomnum} key={roomnum} autoFocus={false} onChange={handleChange1} />
            </div>
            <Input id="username" className='' ref={usernameRef} autoFocus={true} value={username} onChange={handleChange} startAdornment={
              <InputAdornment position="start">
                <AccountCircle />
              </InputAdornment>
            } />
            <div>
              <div className='controlSection'>
                <Stack spacing={2} direction="row" justifyContent="center">
                  <Button variant="outlined" startIcon={<FaceIcon />} size="small" onClick={toggleAvatar}>{avatarStatus}</Button>
                  <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} size="small" onClick={toggleNewRoom}>new room</Button>
                  <Button variant="outlined" startIcon={<ConnectWithoutContactIcon />} size="small" onClick={connectToRoom} disabled={connectDisabled}>Join meeting</Button>
                </Stack>
              </div>
            </div>
          </div>
        </div>
        <div className='controlSection'>
          <Stack spacing={2} direction="row" justifyContent="center">
            <Button variant="outlined" startIcon={audioEnabled ? <MicIcon /> : <MicOffIcon />} size="small" onClick={toggleAudio}>{mutebuttonText}</Button>
            <Button variant="outlined" startIcon={videoEnabled ? <VideoCameraFrontIcon /> : <VideocamOffIcon />} size="small" onClick={toggleVedio}>{vediobuttonText}</Button>
          </Stack>
        </div>
        <div className='controlSection'>
          <Stack spacing={2} direction="row" justifyContent="center">
            <video id="video_local" autoPlay playsInline ref={videoRefLocal} height="350" width="350"></video>
            <video id="video_remote" autoPlay ref={videoRefRemote} height="350" width="350"></video>
          </Stack>
        </div>
        <div>
          <SelectAvatarDialog
            selectedValue={selectedValue}
            open={open}
            onClose={handleClose} />
        </div>
      </main>
      <footer>
        Homepage <a href="https://aiit.gitclone.com">Aiit</a>
        &nbsp; (
        <a href="https://aiit.gitclone.com">
          source
        </a>
        )
      </footer>
    </div>
  );
};
