import {
  StyleSheet,
  View,
  Text,
  Image,
  Platform,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Animated as ReactAnimated,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import React, { FC, useContext, useEffect, useRef, useState } from 'react'
import themeContext from '../../../assets/styles/themeContext'

/* Navigation imports */
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../../App'

/* Components imports */
import Slider from '@react-native-community/slider'
import { AntDesign, Feather, MaterialCommunityIcons } from '@expo/vector-icons'

/* utils imports */
// import { Song } from '../../utils/Song'
import { windowWidth } from '../../utils/Dimensions'

/* Music Player imports */
import {
  useCurrentTrack,
  useOnTogglePlayback,
} from '../../MusicPlayerServices/MusicPlayerActions'
import TrackPlayer, {
  Event,
  RepeatMode,
  State,
  Track,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player'

type SongsCarouselProps = NativeStackScreenProps<
  RootStackParamList,
  'SongsCarousel'
>

const SongsCarousel: FC<SongsCarouselProps> = ({ navigation }) => {
  /* General use variables */
  const theme = useContext(themeContext)
  const [isLoading, setIsLoading] = useState(true)

  /* TrackPlayer variables initialization */
  const isPlaying = usePlaybackState() === State.Playing
  const onTogglePlayback = useOnTogglePlayback()
  const progress = useProgress()
  const currentTrack = useCurrentTrack()

  /* Carousel variables initialization */
  const carouselRef = useRef<FlatList>(null)
  const scrollX = useRef(new ReactAnimated.Value(0)).current
  const [songIndex, setSongIndex] = useState(0)
  const [repeatMode, setRepeatMode] = useState('off')
  const [trackTitle, setTrackTitle] = useState<string>()
  const [trackArtist, setTrackArtist] = useState<string>()
  const [trackArtwork, setTrackArtwork] = useState<number>()
  const [trackRating, setTrackRating] = useState<number | boolean>()

  /* Trackplayer event listener */
  useTrackPlayerEvents([Event.PlaybackTrackChanged], async (event) => {
    if (
      event.type === Event.PlaybackTrackChanged &&
      event.nextTrack !== undefined
    ) {
      const track = await TrackPlayer.getTrack(event.nextTrack)

      if (track !== null) {
        const { title, artist, id, rating } = track
        setTrackTitle(title)
        setTrackArtist(artist)
        setTrackArtwork(id)
        setTrackRating(rating)
      }
    }
  })

  /* Function: Changes repeat icon according to user's choice */
  const repeatIcon = () => {
    if (repeatMode === 'off') {
      return 'repeat-off'
    }
    if (repeatMode === 'track') {
      return 'repeat-once'
    }
    if (repeatMode === 'repeat') {
      return 'repeat'
    }
  }

  /* Function: sets repeat mode */
  const changeRepeatMode = () => {
    if (repeatMode === 'off') {
      TrackPlayer.setRepeatMode(RepeatMode.Track)
      setRepeatMode('track')
    }
    if (repeatMode === 'track') {
      TrackPlayer.setRepeatMode(RepeatMode.Queue)
      setRepeatMode('repeat')
    }
    if (repeatMode === 'repeat') {
      TrackPlayer.setRepeatMode(RepeatMode.Off)
      setRepeatMode('off')
    }
  }

  /* Function: skip to specific track */
  const skipTo = async (trackID: number) => {
    await TrackPlayer.skip(trackID)
    await TrackPlayer.play()
  }

  /* Function: skip to next track */
  const skipToNext = () => {
    if (carouselRef.current != null) {
      carouselRef.current.scrollToOffset({
        offset: (songIndex + 1) * windowWidth,
      })
    }
  }

  /* Function: skip to previous track */
  const skipToPrevious = () => {
    // Returns to beginning of track, according to current position
    if (progress.position > 3) {
      TrackPlayer.seekTo(0)
    } else if (carouselRef.current != null) {
      carouselRef.current.scrollToOffset({
        offset: (songIndex - 1) * windowWidth,
      })
    }
  }

  /* Carousel scrolling */
  useEffect(() => {
    scrollX.addListener(({ value }) => {
      const index = Math.round(value / windowWidth)
      skipTo(index)
      setSongIndex(index)
    })
    return () => scrollX.removeAllListeners()
  }, [])

  /* Function: posts like/unlike */
  const likeSong = async (songID: number) => {
    const trackId = await TrackPlayer.getCurrentTrack()
    if (trackRating === false) {
      await fetch('http://192.168.1.131:5000/songs/' + songID + '/like', {
        method: 'POST',
      })
      TrackPlayer.updateMetadataForTrack(trackId, {
        rating: true,
      })
      setTrackRating(true)
    } else {
      await fetch('http://192.168.1.131:5000/songs/' + songID + '/unlike', {
        method: 'DELETE',
      })
      TrackPlayer.updateMetadataForTrack(trackId, {
        rating: false,
      })
      setTrackRating(false)
    }
  }

  /* Function: fetches required songs */
  const [data, setData] = useState<Track[]>([])
  const fetchSongs = async () => {
    await fetch('http://192.168.1.131:5000/check', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
      .then((response) => response.json())
      .then((json) => setData(json))
      .catch((error) => console.error(error))
  }

  /* Function: sets up tracks for TrackPlayer */
  const tracks: Track[] = []
  const setupTracks = async () => {
    data.forEach((item) => {
      const track: Track = {
        id: 0,
        url: '',
        title: '',
        artist: '',
        artwork: '',
      }
      track['id'] = item.Song.id
      track['url'] =
        'http://192.168.1.131:5000/songs/' + item.Song.id + '/stream'
      track['title'] = item.Song.title
      track['artist'] = item.Song.artist
      track['artwork'] = item.Song.artwork
      track['rating'] = item.song_id ? true : false
      tracks.push(track)
    })
    await TrackPlayer.add(tracks)
    console.log('data received: ', data)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchSongs()
  }, [])

  // Sets up tracks for TrackPlayer after data is fetched & set
  useEffect(() => {
    setupTracks()
  }, [data])

  /* Function (Carousel): renders track's artwork */
  const renderSong = () => {
    return (
      <View style={styles.carouselImageContainer}>
        <Image
          source={{
            uri: 'http://192.168.1.131:5000/songs/' + trackArtwork + '/artwork',
          }}
          key={trackArtwork}
          style={styles.carouselImage}
        />
      </View>
    )
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {isLoading ? (
        <View style={styles.activityIndicatorContainer}>
          <ActivityIndicator size='large' color={theme.primary} />
        </View>
      ) : (
        <View>
          {/* Header */}
          <View style={styles.headerWrapper}>
            <View style={styles.headerLeftContainer}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <AntDesign name='arrowleft' size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View>
              <Text style={[styles.playingNowTitle, { color: theme.primary }]}>
                Playing Now
              </Text>
            </View>
            <View style={styles.headerRightContainer} />
          </View>

          {/* Songs Carousel */}
          <ReactAnimated.FlatList
            ref={carouselRef}
            data={data}
            renderItem={renderSong}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={ReactAnimated.event(
              [
                {
                  nativeEvent: {
                    contentOffset: { x: scrollX },
                  },
                },
              ],
              { useNativeDriver: true },
            )}
          />

          <View>
            <Text
              style={{
                paddingTop: 20,
                paddingHorizontal: 35,
                fontFamily: 'Roboto_500Medium',
                textAlign: 'center',
                fontSize: 24,
                color: theme.primary,
              }}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {trackTitle}
            </Text>
            <Text
              style={{
                paddingTop: 5,
                paddingHorizontal: 30,
                fontFamily: 'Roboto_400Regular',
                textTransform: 'uppercase',
                textAlign: 'center',
                fontSize: 16,
                color: theme.author,
              }}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {trackArtist}
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsWrapper}>
            <View style={styles.optionsLeftContainer}>
              <Feather name='volume-1' size={20} color={theme.icon} />
            </View>
            <View style={styles.optionsCenterContainer}>
              {trackRating ? (
                <TouchableOpacity
                  onPress={() => {
                    likeSong(currentTrack?.id)
                  }}
                >
                  <AntDesign name={'heart'} size={20} color={'red'} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    likeSong(currentTrack?.id)
                  }}
                >
                  <AntDesign name={'hearto'} size={20} color={theme.icon} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.optionsRightContainer}>
              <TouchableOpacity onPress={changeRepeatMode}>
                <MaterialCommunityIcons
                  name={repeatIcon()}
                  size={20}
                  color={repeatMode !== 'off' ? theme.primary : theme.icon}
                />
              </TouchableOpacity>
              <Feather
                name='shuffle'
                size={20}
                color={theme.icon}
                style={styles.shuffleIcon}
              />
            </View>
          </View>

          {/* Slider Times */}
          <View style={styles.sliderTimesWrapper}>
            <Text style={[styles.sliderTime, { color: theme.primary }]}>
              {new Date(progress.position * 1000).toISOString().slice(14, 19)}
            </Text>
            <Text style={[styles.sliderTime, { color: theme.primary }]}>
              {new Date((progress.duration - progress.position) * 1000)
                .toISOString()
                .slice(14, 19)}
            </Text>
          </View>

          {/* Slider */}
          <Slider
            style={styles.slider}
            value={progress.position}
            minimumValue={0}
            maximumValue={progress.duration}
            thumbTintColor={theme.primary}
            minimumTrackTintColor={theme.primary}
            maximumTrackTintColor={theme.primary}
            onSlidingComplete={async (value) => {
              TrackPlayer.seekTo(value)
            }}
          />

          {/* Controllers */}
          <View style={styles.controllersWrapper}>
            <TouchableOpacity onPress={skipToPrevious}>
              <Feather name='skip-back' size={30} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onTogglePlayback}>
              <AntDesign
                name={isPlaying ? 'pause' : 'playcircleo'}
                style={{ marginLeft: 40 }}
                size={35}
                color={theme.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={skipToNext}>
              <Feather
                name='skip-forward'
                style={{ marginLeft: 40 }}
                size={30}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  activityIndicatorContainer: {
    minHeight: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  headerWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 35,
  },
  headerLeftContainer: {
    flex: 1,
    paddingLeft: 30,
  },
  playingNowTitle: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 20,
    textAlign: 'center',
  },
  headerRightContainer: {
    flex: 1,
    paddingRight: 30,
  },
  carouselImageContainer: {
    width: windowWidth,
    paddingTop: 40,
    paddingBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: 260,
    height: 260,
    borderRadius: 5,
  },
  optionsWrapper: {
    paddingTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionsLeftContainer: {
    flex: 1,
    paddingLeft: 30,
  },
  optionsCenterContainer: {
    flex: 1,
    alignItems: 'center',
  },
  optionsRightContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 30,
  },
  shuffleIcon: {
    marginLeft: 15,
  },
  sliderTimesWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 30,
  },
  sliderTime: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
  },
  slider: {
    marginHorizontal: 15,
  },
  controllersWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 35,
    marginBottom: 50,
  },
})

export default SongsCarousel
