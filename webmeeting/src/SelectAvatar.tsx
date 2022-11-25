import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

export interface SelectAvatarDialogProps {
  open: boolean;
  selectedValue: string;
  onClose: (value: string) => void;
}

export default function SelectAvatarDialog(props: SelectAvatarDialogProps) {
  const { onClose, selectedValue, open } = props;

  const handleClose = () => {
    onClose(selectedValue);
  };

  const handleListItemClick = (value: string) => {
    onClose(value);
  };

  const itemData = [
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/1.png',
      title: '1',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/2.png',
      title: '2',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/3.png',
      title: '3',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/4.png',
      title: '4',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/5.png',
      title: '5',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/6.png',
      title: '6',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/7.png',
      title: '7',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/8.png',
      title: '8',
    },
    {
      img: 'https://gitclone.com/aiit/avatarify-webrtc/avatars/9.png',
      title: '9',
    }
  ];

  return (
    <Dialog onClose={handleClose} open={open}>
      <DialogTitle>select avatar</DialogTitle>
      <ImageList sx={{ width: 300, height: 300 }} cols={3} rowHeight={50}>
      {itemData.map((item) => (
        <ImageListItem key={item.img}>
          <img
            src={`${item.img}`}
            srcSet={`${item.img}`}
            alt={item.title}
            loading="lazy"
            onClick={() => handleListItemClick(item.title)}
          />
        </ImageListItem>
      ))}
    </ImageList>
      <DialogActions>
          <Button onClick={() => handleListItemClick('0')}>Cancel</Button>
        </DialogActions>
    </Dialog>
  );
}