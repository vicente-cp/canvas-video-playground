# canvas-video-playground
Testing ground for exploring frame-precise video manipulation . This repo serves as a sandbox for experimenting with various video playback, frame extraction, and manipulation techniques within a Next.js, React, and Tailwind CSS environment. 

# WebCodecs API
One of the tests relies heavily on the WebCodecs API for both rendering individual frames and syncing video and audio. Big ups to the W3C team and the contributors to [W3C](https://w3c.github.io/).

## Video rendering alternatives:

We test two main approaches for rendering video content, with tradeoffs between efficiency, resource utilization, and playback quality:

### Decode all samples first, store the decoded frames in an array, and then play them one after the other:

Advantages:
- This approach provides a smoother playback experience as it entails pre-decoding all frames and storing them in an array, ensuring that they are readily available for playback.
- Implementing seeking and frame navigation becomes significantly easier with this method, as frames can be directly accessed from the pre-decoded array, facilitating seamless user interaction.
- Due to the pre-decoding of frames, there is a notable reduction in latency during playback, enhancing the responsiveness of the system.

Disadvantages:
- However, this method comes at the cost of higher memory consumption, as all decoded frames must be stored in memory simultaneously, potentially posing challenges for devices with limited memory resources.
- The initial loading time is extended since all frames need to be decoded before playback can commence, which might lead to user frustration, particularly for larger video files.
- Furthermore, for prolonged videos or devices with constrained memory resources, this approach may not be the most optimal choice, given its propensity to exhaust available memory.

### Decode one frame, serve it to the canvas, then decode the next frame, and so on:

Advantages:
- Alternatively, decoding one frame at a time and serving it to the canvas before decoding the subsequent frame offers advantages in terms of lower memory consumption. This is because only one frame needs to be decoded and stored in memory at any given moment.
- As a result of this incremental decoding process, the initial loading time is significantly reduced, enabling playback to commence promptly once the first frame is decoded.
- This approach is particularly well-suited for handling long videos or operating on devices with limited memory resources, where conserving memory is paramount.

Disadvantages:
- Nonetheless, there is a risk of stuttering or lag during playback if the decoding process takes longer than the frame duration, potentially compromising the viewing experience.
- Implementing seeking and frame navigation becomes more intricate with this method, as frames need to be decoded on-the-fly, introducing complexities in managing playback control.
- Additionally, the real-time decoding process inherent in this approach results in higher latency during playback, which may impact the responsiveness of the system.





