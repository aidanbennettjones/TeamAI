import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Hero from '../Hero';
import { useDropzone } from 'react-dropzone';
import DragFileUpload from '../assets/DragFileUpload.svg';
import ArrowDown from '../assets/arrow-down.svg';
import newChatIcon from '../assets/openNewChat.svg';
import Send from '../assets/send.svg';
import SendDark from '../assets/send_dark.svg';
import ShareIcon from '../assets/share.svg';
import SpinnerDark from '../assets/spinner-dark.svg';
import Spinner from '../assets/spinner.svg';
import RetryIcon from '../components/RetryIcon';
import { useDarkTheme, useMediaQuery } from '../hooks';
import { ShareConversationModal } from '../modals/ShareConversationModal';
import { selectConversationId } from '../preferences/preferenceSlice';
import { AppDispatch } from '../store';
import ConversationBubble from './ConversationBubble';
import { handleSendFeedback } from './conversationHandlers';
import { FEEDBACK, Query } from './conversationModels';
import {
  addQuery,
  fetchAnswer,
  resendQuery,
  selectQueries,
  selectStatus,
  setConversation,
  updateConversationId,
  updateQuery,
} from './conversationSlice';
import Upload from '../upload/Upload';
import { ActiveState } from '../models/misc';

export default function Conversation() {
  const queries = useSelector(selectQueries);
  const navigate = useNavigate();
  const status = useSelector(selectStatus);
  const conversationId = useSelector(selectConversationId);
  const dispatch = useDispatch<AppDispatch>();
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isDarkTheme] = useDarkTheme();
  const [hasScrolledToLast, setHasScrolledToLast] = useState(true);
  const fetchStream = useRef<any>(null);
  const [eventInterrupt, setEventInterrupt] = useState(false);
  const [lastQueryReturnedErr, setLastQueryReturnedErr] = useState(false);
  const [isShareModalOpen, setShareModalState] = useState<boolean>(false);
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const [uploadModalState, setUploadModalState] =
    useState<ActiveState>('INACTIVE');
  const [files, setFiles] = useState<File[]>([]);
  const [handleDragActive, setHandleDragActive] = useState<boolean>(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadModalState('ACTIVE');
    setFiles(acceptedFiles);
    setHandleDragActive(false);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    noClick: true,
    multiple: true,
    onDragEnter: () => {
      setHandleDragActive(true);
    },
    onDragLeave: () => {
      setHandleDragActive(false);
    },
    maxSize: 25000000,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/x-rst': ['.rst'],
      'text/x-markdown': ['.md'],
      'application/zip': ['.zip'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'text/html': ['.html'],
      'application/epub+zip': ['.epub'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        ['.pptx'],
    },
  });

  const handleUserInterruption = () => {
    if (!eventInterrupt && status === 'loading') setEventInterrupt(true);
  };
  useEffect(() => {
    !eventInterrupt && scrollIntoView();
    if (queries.length == 0) {
      resetConversation();
    }
  }, [queries.length, queries[queries.length - 1]]);

  useEffect(() => {
    const element = document.getElementById('inputbox') as HTMLTextAreaElement;
    if (element) {
      element.focus();
    }
  }, []);

  useEffect(() => {
    if (queries.length) {
      queries[queries.length - 1].error && setLastQueryReturnedErr(true);
      queries[queries.length - 1].response && setLastQueryReturnedErr(false); //considering a query that initially returned error can later include a response property on retry
    }
  }, [queries[queries.length - 1]]);

  const scrollIntoView = () => {
    if (!conversationRef?.current || eventInterrupt) return;

    if (status === 'idle' || !queries[queries.length - 1].response) {
      conversationRef.current.scrollTo({
        behavior: 'smooth',
        top: conversationRef.current.scrollHeight,
      });
    } else {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  };

  const handleQuestion = ({
    question,
    isRetry = false,
    updated = null,
    indx = undefined,
  }: {
    question: string;
    isRetry?: boolean;
    updated?: boolean | null;
    indx?: number;
  }) => {
    if (updated === true) {
      !isRetry &&
        dispatch(resendQuery({ index: indx as number, prompt: question })); //dispatch only new queries
      fetchStream.current = dispatch(fetchAnswer({ question, indx }));
    } else {
      question = question.trim();
      if (question === '') return;
      setEventInterrupt(false);
      !isRetry && dispatch(addQuery({ prompt: question })); //dispatch only new queries
      fetchStream.current = dispatch(fetchAnswer({ question }));
    }
  };

  const handleFeedback = (query: Query, feedback: FEEDBACK, index: number) => {
    const prevFeedback = query.feedback;
    dispatch(updateQuery({ index, query: { feedback } }));
    handleSendFeedback(
      query.prompt,
      query.response!,
      feedback,
      conversationId as string,
      index,
    ).catch(() =>
      handleSendFeedback(
        query.prompt,
        query.response!,
        feedback,
        conversationId as string,
        index,
      ).catch(() =>
        dispatch(updateQuery({ index, query: { feedback: prevFeedback } })),
      ),
    );
  };

  const handleQuestionSubmission = (
    updatedQuestion?: string,
    updated?: boolean,
    indx?: number,
  ) => {
    if (updated === true) {
      handleQuestion({ question: updatedQuestion as string, updated, indx });
    } else if (inputRef.current?.value && status !== 'loading') {
      if (lastQueryReturnedErr) {
        // update last failed query with new prompt
        dispatch(
          updateQuery({
            index: queries.length - 1,
            query: {
              prompt: inputRef.current.value,
            },
          }),
        );
        handleQuestion({
          question: queries[queries.length - 1].prompt,
          isRetry: true,
        });
      } else {
        handleQuestion({ question: inputRef.current.value });
      }
      inputRef.current.value = '';
      handleInput();
    }
  };
  const resetConversation = () => {
    dispatch(setConversation([]));
    dispatch(
      updateConversationId({
        query: { conversationId: null },
      }),
    );
  };
  const newChat = () => {
    if (queries && queries.length > 0) resetConversation();
  };

  const prepResponseView = (query: Query, index: number) => {
    let responseView;
    if (query.response) {
      responseView = (
        <ConversationBubble
          className={`${index === queries.length - 1 ? 'mb-32' : 'mb-7'}`}
          key={`${index}ANSWER`}
          message={query.response}
          type={'ANSWER'}
          sources={query.sources}
          toolCalls={query.tool_calls}
          feedback={query.feedback}
          handleFeedback={(feedback: FEEDBACK) =>
            handleFeedback(query, feedback, index)
          }
        ></ConversationBubble>
      );
    } else if (query.error) {
      const retryBtn = (
        <button
          className="flex items-center justify-center gap-3 self-center rounded-full py-3 px-5  text-lg text-gray-500 transition-colors delay-100 hover:border-gray-500 disabled:cursor-not-allowed dark:text-bright-gray"
          disabled={status === 'loading'}
          onClick={() => {
            handleQuestion({
              question: queries[queries.length - 1].prompt,
              isRetry: true,
            });
          }}
        >
          <RetryIcon
            width={isMobile ? 12 : 12} // change the width and height according to device size if necessary
            height={isMobile ? 12 : 12}
            fill={isDarkTheme ? 'rgb(236 236 241)' : 'rgb(107 114 120)'}
            stroke={isDarkTheme ? 'rgb(236 236 241)' : 'rgb(107 114 120)'}
            strokeWidth={10}
          />
        </button>
      );
      responseView = (
        <ConversationBubble
          className={`${index === queries.length - 1 ? 'mb-32' : 'mb-7'} `}
          key={`${index}ERROR`}
          message={query.error}
          type="ERROR"
          retryBtn={retryBtn}
        ></ConversationBubble>
      );
    }
    return responseView;
  };

  const handleInput = () => {
    if (inputRef.current) {
      if (window.innerWidth < 350) inputRef.current.style.height = 'auto';
      else inputRef.current.style.height = '64px';
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        96,
      )}px`;
    }
  };
  const checkScroll = () => {
    const el = conversationRef.current;
    if (!el) return;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    setHasScrolledToLast(isBottom);
  };
  useEffect(() => {
    handleInput();
    window.addEventListener('resize', handleInput);
    conversationRef.current?.addEventListener('scroll', checkScroll);
    return () => {
      window.removeEventListener('resize', handleInput);
      conversationRef.current?.removeEventListener('scroll', checkScroll);
    };
  }, []);
  return (
    <div className="flex flex-col gap-1 h-full justify-end ">
      {conversationId && queries.length > 0 && (
        <div className="absolute top-4 right-20">
          <div className="flex mt-2 items-center gap-4">
            {isMobile && queries.length > 0 && (
              <button
                title="Open New Chat"
                onClick={() => {
                  newChat();
                }}
                className="hover:bg-bright-gray dark:hover:bg-[#28292E] rounded-full p-2"
              >
                <img
                  className="h-5 w-5 filter dark:invert"
                  alt="NewChat"
                  src={newChatIcon}
                />
              </button>
            )}

            <button
              title="Share"
              onClick={() => {
                setShareModalState(true);
              }}
              className="hover:bg-bright-gray dark:hover:bg-[#28292E] rounded-full p-2"
            >
              <img
                className="h-5 w-5 filter dark:invert"
                alt="share"
                src={ShareIcon}
              />
            </button>
          </div>
          {isShareModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50 dark:bg-gray-alpha" />
              <div className="relative z-50 w-full max-w-md rounded-3xl">
                <ShareConversationModal
                  close={() => {
                    setShareModalState(false);
                  }}
                  conversationId={conversationId}
                />
              </div>
            </div>
          )}
        </div>
      )}
      <div
        ref={conversationRef}
        onWheel={handleUserInterruption}
        onTouchMove={handleUserInterruption}
        className="flex justify-center w-full overflow-y-auto h-screen sm:mt-12"
      >
        {queries.length > 0 && !hasScrolledToLast && (
          <button
            onClick={scrollIntoView}
            aria-label="scroll to bottom"
            className="fixed bottom-40 right-14 z-10 flex h-7 w-7  items-center justify-center rounded-full border-[0.5px] border-gray-alpha bg-gray-100 bg-opacity-50 dark:bg-purple-taupe md:h-9 md:w-9 md:bg-opacity-100 "
          >
            <img
              src={ArrowDown}
              alt="arrow down"
              className="h-4 w-4 opacity-50 md:h-5 md:w-5"
            />
          </button>
        )}

        {queries.length > 0 ? (
          <div className="w-full md:w-8/12">
            {queries.map((query, index) => {
              return (
                <Fragment key={index}>
                  <ConversationBubble
                    className={'first:mt-5'}
                    key={`${index}QUESTION`}
                    message={query.prompt}
                    type="QUESTION"
                    handleUpdatedQuestionSubmission={handleQuestionSubmission}
                    questionNumber={index}
                    sources={query.sources}
                  ></ConversationBubble>

                  {prepResponseView(query, index)}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <Hero handleQuestion={handleQuestion} />
        )}
      </div>

      <div className="flex flex-col items-end self-center rounded-2xl bg-opacity-0 z-3 w-[calc(min(742px,92%))] h-auto py-1">
        <div
          {...getRootProps()}
          className="flex w-full items-center rounded-[40px] border dark:border-grey border-dark-gray bg-lotion dark:bg-charleston-green-3"
        >
          <label htmlFor="file-upload" className="sr-only">
            {t('modals.uploadDoc.label')}
          </label>
          <input {...getInputProps()} id="file-upload" />
          <label htmlFor="message-input" className="sr-only">
            {t('inputPlaceholder')}
          </label>
          <textarea
            id="message-input"
            ref={inputRef}
            tabIndex={1}
            placeholder={t('inputPlaceholder')}
            className={`inputbox-style w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-full bg-lotion dark:bg-charleston-green-3 py-5 text-base leading-tight opacity-100 focus:outline-none dark:text-bright-gray dark:placeholder-bright-gray dark:placeholder-opacity-50`}
            onInput={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQuestionSubmission();
              }
            }}
            aria-label={t('inputPlaceholder')}
          ></textarea>
          {status === 'loading' ? (
            <img
              src={isDarkTheme ? SpinnerDark : Spinner}
              className="relative right-[38px] bottom-[24px] -mr-[30px] animate-spin cursor-pointer self-end bg-transparent"
              alt={t('loading')}
            />
          ) : (
            <div className="mx-1 cursor-pointer rounded-full p-3 text-center hover:bg-gray-3000 dark:hover:bg-dark-charcoal">
              <button
                onClick={() => handleQuestionSubmission()}
                aria-label={t('send')}
                className="flex items-center justify-center"
              >
                <img
                  className="ml-[4px] h-6 w-6 text-white filter dark:invert-[0.45] invert-[0.35]"
                  src={isDarkTheme ? SendDark : Send}
                  alt={t('send')}
                />
              </button>
            </div>
          )}
        </div>

        <p className="text-gray-4000 hidden w-[100vw] self-center bg-transparent py-2 text-center text-xs dark:text-sonic-silver md:inline md:w-full">
          {t('tagline')}
        </p>
      </div>
      {handleDragActive && (
        <div className="pointer-events-none fixed top-0 left-0 z-30 flex flex-col size-full items-center justify-center bg-opacity-50 bg-white dark:bg-gray-alpha">
          <img className="filter dark:invert" src={DragFileUpload} />
          <span className="px-2 text-2xl font-bold text-outer-space dark:text-silver">
            {t('modals.uploadDoc.drag.title')}
          </span>
          <span className="p-2 text-s w-48 text-center text-outer-space dark:text-silver">
            {t('modals.uploadDoc.drag.description')}
          </span>
        </div>
      )}
      {uploadModalState === 'ACTIVE' && (
        <Upload
          receivedFile={files}
          setModalState={setUploadModalState}
          isOnboarding={false}
          renderTab={'file'}
          close={() => setUploadModalState('INACTIVE')}
        ></Upload>
      )}
    </div>
  );
}
