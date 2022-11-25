export interface RTCOptions {
    destination: any;
    source?: any;
    debug?: boolean;
    offerOptions?: RTCOfferOptions;
    audio?: boolean;
    video?: boolean;
    avator?:string;
}

export class WebrtcCli {
    private readonly options: RTCOptions;
    private pc: RTCPeerConnection | null;
    constructor(options: RTCOptions) {
        this.options = options
        this.pc = null;
    }

    startRecording = async () => {
        this.pc = await this.startCamera(this.options.source, this.options.debug, this.options.audio, this.options.video)
    }

    stopRecording = () => {
        this.pc = this.pc ? this.stopCamera(this.pc, this.options.source) : this.pc
        this.pc = null
    }

    createPeerConnection = (debug?: boolean) => {
        var config = {} ;
        var url = window.location.host;
        if (!(url.includes("127.0.0.1")) && !(url.includes("localhost"))){
            config = {
                sdpSemantics: 'unified-plan',
                iceServers: [{
                    urls: "turn:gitclone.com:3478",
                    username: "webrtc",
                    credential: "Webrtc987123654"
                }]
            }  
        } 

        let pc = new RTCPeerConnection(config)

        if (debug) {
            console.log(pc.iceGatheringState)
            console.log(pc.iceConnectionState)
            console.log(pc.signalingState)
            pc.addEventListener('icegatheringstatechange', () => console.log(pc.iceGatheringState))
            pc.addEventListener('iceconnectionstatechange', () => console.log(pc.iceConnectionState))
            pc.addEventListener('signalingstatechange', () => console.log(pc.signalingState))
        }

        let onTrack = (ev: RTCTrackEvent) => {
            this.options.destination.srcObject = ev.streams[0]
        }

        pc.addEventListener('track', onTrack)
        return pc
    }

    negotiate = async (pc: RTCPeerConnection, offerOptions: RTCOfferOptions) => {
        let offer = await pc.createOffer(offerOptions)
        await pc.setLocalDescription(offer)
        await new Promise<void>((resolve) => {
            function checkState(this: RTCPeerConnection) {
                if (this.iceGatheringState === 'complete') {
                    this.removeEventListener('icegatheringstatechange', checkState)
                    resolve()
                }
            }
            if (pc.iceGatheringState === 'complete') resolve()
            else pc.addEventListener('icegatheringstatechange', checkState)
        });

        if (pc.localDescription) offer = offer = pc.localDescription
        
        const body = JSON.stringify({ sdp: offer.sdp, type: offer.type, avatar: this.options.avator + "|0"})
        const headers = { 'Content-Type': 'application/json' }
        const response = await fetch('/webrtc/offer', { body, headers, method: 'POST' })
        pc.setRemoteDescription(await response.json())
        return pc
    }

    async startCamera(displaySource?: any, debug?: boolean, audio?: boolean, video?: boolean) {
        const pc = this.createPeerConnection(debug)
        const constraints = { audio, video }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (displaySource) displaySource.srcObject = stream
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        const offerOptions: RTCOfferOptions = {
            offerToReceiveVideo: video,
            offerToReceiveAudio: audio
        }

        return await this.negotiate(pc, offerOptions)
    }

    stopCamera(pc: RTCPeerConnection, displaySource?: HTMLVideoElement) {
        if (displaySource) displaySource.srcObject = null
        const stopTransceiver = (transceiver: RTCRtpTransceiver) => { if (transceiver.stop) transceiver.stop() }
        if (pc.getTransceivers) {
            pc.getTransceivers().forEach(transceiver => stopTransceiver(transceiver))
        }
        pc.getSenders().forEach(sender => sender?.track?.stop())
        setTimeout(function(){
            pc.close() ;
            window.location.reload() ;
        }, 500);        
        return pc
    }
}