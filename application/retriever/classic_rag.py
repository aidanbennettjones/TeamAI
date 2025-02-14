import uuid

from application.core.settings import settings
from application.retriever.base import BaseRetriever
from application.tools.agent import Agent

from application.vectorstore.vector_creator import VectorCreator


class ClassicRAG(BaseRetriever):

    def __init__(
        self,
        question,
        source,
        chat_history,
        prompt,
        chunks=2,
        token_limit=150,
        gpt_model="docsgpt",
        user_api_key=None,
    ):
        self.question = question
        self.vectorstore = source["active_docs"] if "active_docs" in source else None
        self.chat_history = chat_history
        self.prompt = prompt
        self.chunks = chunks
        self.gpt_model = gpt_model
        self.token_limit = (
            token_limit
            if token_limit
            < settings.MODEL_TOKEN_LIMITS.get(
                self.gpt_model, settings.DEFAULT_MAX_HISTORY
            )
            else settings.MODEL_TOKEN_LIMITS.get(
                self.gpt_model, settings.DEFAULT_MAX_HISTORY
            )
        )
        self.user_api_key = user_api_key
        self.agent = Agent(
            llm_name=settings.LLM_NAME,
            gpt_model=self.gpt_model,
            api_key=settings.API_KEY,
            user_api_key=self.user_api_key,
        )

    def _get_data(self):
        if self.chunks == 0:
            docs = []
        else:
            docsearch = VectorCreator.create_vectorstore(
                settings.VECTOR_STORE, self.vectorstore, settings.EMBEDDINGS_KEY
            )
            docs_temp = docsearch.search(self.question, k=self.chunks)
            docs = [
                {
                    "title": i.metadata.get(
                        "title", i.metadata.get("post_title", i.page_content)
                    ).split("/")[-1],
                    "text": i.page_content,
                    "source": (
                        i.metadata.get("source")
                        if i.metadata.get("source")
                        else "local"
                    ),
                }
                for i in docs_temp
            ]

        return docs

    def gen(self):
        docs = self._get_data()

        # join all page_content together with a newline
        docs_together = "\n".join([doc["text"] for doc in docs])
        p_chat_combine = self.prompt.replace("{summaries}", docs_together)
        messages_combine = [{"role": "system", "content": p_chat_combine}]
        for doc in docs:
            yield {"source": doc}

        if len(self.chat_history) > 0:
            for i in self.chat_history:
                if "prompt" in i and "response" in i:
                    messages_combine.append({"role": "user", "content": i["prompt"]})
                    messages_combine.append(
                        {"role": "assistant", "content": i["response"]}
                    )
                if "tool_calls" in i:
                    for tool_call in i["tool_calls"]:
                        call_id = tool_call.get("call_id")
                        if call_id is None or call_id == "None":
                            call_id = str(uuid.uuid4())

                        function_call_dict = {
                            "function_call": {
                                "name": tool_call.get("action_name"),
                                "args": tool_call.get("arguments"),
                                "call_id": call_id,
                            }
                        }
                        function_response_dict = {
                            "function_response": {
                                "name": tool_call.get("action_name"),
                                "response": {"result": tool_call.get("result")},
                                "call_id": call_id,
                            }
                        }

                        messages_combine.append(
                            {"role": "assistant", "content": [function_call_dict]}
                        )
                        messages_combine.append(
                            {"role": "tool", "content": [function_response_dict]}
                        )

        messages_combine.append({"role": "user", "content": self.question})
        completion = self.agent.gen(messages_combine)

        for line in completion:
            yield {"answer": str(line)}

        yield {"tool_calls": self.agent.tool_calls.copy()}

    def search(self):
        return self._get_data()

    def get_params(self):
        return {
            "question": self.question,
            "source": self.vectorstore,
            "chat_history": self.chat_history,
            "prompt": self.prompt,
            "chunks": self.chunks,
            "token_limit": self.token_limit,
            "gpt_model": self.gpt_model,
            "user_api_key": self.user_api_key,
        }
